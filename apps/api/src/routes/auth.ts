import { Router } from "express";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { ipKeyGenerator } from "express-rate-limit";
import { createAuthToken } from "../services/auth.service.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { createEmailVerificationToken, sendEmailVerification, verifyEmailVerificationToken, createOtpChallenge, sendEmailOtp, verifyOtpChallenge } from "../services/email.service.js";
import { env } from "../config/env.js";

const router = Router();
const scrypt = promisify(scryptCallback);

// Rate limiting configurations
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again later." },
  skipSuccessfulRequests: true, // Don't count successful logins
});

const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many registration attempts. Please try again later." },
});

const otpRequestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per window per user
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many OTP requests. Please try again later." },
  keyGenerator: (req) => {
    // Rate limit by authenticated user ID instead of IP
    return req.userId || ipKeyGenerator(req);
  },
});

const otpVerifyRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes (OTP lifetime)
  max: 10, // 10 verification attempts per challenge
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many verification attempts. Please request a new OTP." },
  keyGenerator: (req) => {
    // Rate limit by challenge token to prevent brute force of a specific OTP
    const challenge = typeof req.body?.challenge === "string" ? req.body.challenge : "";
    return challenge || ipKeyGenerator(req);
  },
});
const credentials = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(128) });
const emailInput = z.object({ email: z.string().trim().toLowerCase().email() });
const otpInput = z.object({ email: z.string().trim().toLowerCase().email(), challenge: z.string().min(20), code: z.string().regex(/^\d{6}$/) });

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [scheme, saltHex, hashHex] = encoded.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const derived = (await scrypt(password, Buffer.from(saltHex, "hex"), 64)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

router.post("/register", registerRateLimiter, async (req, res, next) => {
  try {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Use a valid email and a password of at least 8 characters." });
    const email = parsed.data.email;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ success: false, message: "An account with that email already exists." });
    const displayName = email.split("@")[0] ?? null;
    const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword(parsed.data.password), status: "PENDING", emailVerifiedAt: null, displayName } });
    const token = await createAuthToken(user.id);
    const verificationToken = createEmailVerificationToken(user.id, email, null);
    try { await sendEmailVerification(email, `${env.WEB_ORIGIN}/account?verifyEmail=${encodeURIComponent(verificationToken)}`); }
    catch (error) { console.error("Initial email verification delivery failed:", error); }
    return res.status(201).json({ success: true, token, user, emailVerificationRequired: true });
  } catch (e) { next(e); }
});

router.post("/login", loginRateLimiter, async (req, res, next) => {
  try {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Email and password are required." });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !user.passwordHash || ["BANNED", "DELETED", "SUSPENDED"].includes(user.status) || !(await verifyPassword(parsed.data.password, user.passwordHash))) return res.status(401).json({ success: false, message: "Invalid email or password." });
    if (!user.emailVerifiedAt) return res.status(403).json({ success: false, message: "Verify your email before signing in.", emailVerificationRequired: true });
    const token = await createAuthToken(user.id);
    return res.json({ success: true, token, user });
  } catch (e) { next(e); }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, user });
  } catch (e) { next(e); }
});

router.post("/email/request-verification", requireAuth, otpRequestRateLimiter, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const parsed = emailInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Enter a valid email address." });
    const email = parsed.data.email;
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.email === email && user.emailVerifiedAt) return res.json({ success: true, verified: true, message: "Email is already verified." });
    const conflict = await prisma.user.findUnique({ where: { email } });
    if (conflict && conflict.id !== user.id) return res.status(409).json({ success: false, message: "That email is already attached to another Raven Oracle account." });
    const { code, challenge } = createOtpChallenge(user.id, email);
    await sendEmailOtp(email, code);
    await prisma.user.update({ where: { id: user.id }, data: { email, emailVerifiedAt: null } });
    return res.json({ success: true, verified: false, challenge, message: "A 6-digit OTP was sent from Raven Oracle to your email." });
  } catch (e) { next(e); }
});

router.post("/email/verify-otp", requireAuth, otpVerifyRateLimiter, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const parsed = otpInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Enter the 6-digit OTP." });
    const email = parsed.data.email;
    verifyOtpChallenge(parsed.data.challenge, req.userId, email, parsed.data.code);
    const user = await prisma.user.update({ where: { id: req.userId }, data: { email, emailVerifiedAt: new Date(), status: "ACTIVE" } });
    const token = await createAuthToken(user.id);
    return res.json({ success: true, token, user, message: "Email verified successfully." });
  } catch (e) {
    const message = e instanceof Error ? e.message : "OTP verification failed";
    return res.status(400).json({ success: false, message });
  }
});

router.post("/email/verify", async (req, res, next) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const data = verifyEmailVerificationToken(token);
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) return res.status(404).json({ success: false, message: "Account not found." });
    if (user.email !== null && user.email !== data.email) return res.status(409).json({ success: false, message: "This verification link is no longer valid." });
    const updated = await prisma.user.update({ where: { id: user.id }, data: { email: data.email, emailVerifiedAt: new Date(), status: "ACTIVE" } });
    const authToken = await createAuthToken(updated.id);
    return res.json({ success: true, token: authToken, user: updated, message: "Email verified successfully." });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Email verification failed";
    return res.status(400).json({ success: false, message });
  }
});

export default router;
