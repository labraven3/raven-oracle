import { Router } from "express";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { createAuthToken } from "../services/auth.service.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { createEmailVerificationToken, sendEmailVerification, verifyEmailVerificationToken, createOtpChallenge, sendEmailOtp, verifyOtpChallenge } from "../services/email.service.js";
import { env } from "../config/env.js";
import { logLoginSuccess, logLoginFailed, logRegistration, logEmailVerificationSuccess, logEmailVerificationFailed, logOtpRequest, logOtpVerificationSuccess, logOtpVerificationFailed, logLogout } from "../services/auth-audit.service.js";

const router = Router();
const scrypt = promisify(scryptCallback);
const USER_SESSION_COOKIE = "raven_token";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const loginRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many login attempts. Please try again later." }, skipSuccessfulRequests: true });
const registerRateLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many registration attempts. Please try again later." } });
const verificationResendRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 3, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many verification email requests. Please try again later." } });
const otpRequestRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 3, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many OTP requests. Please try again later." } });
const otpVerifyRateLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many verification attempts. Please request a new OTP." } });

const credentials = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(12, "Password must be at least 12 characters long").max(128, "Password must not exceed 128 characters").regex(/[A-Z]/, "Password must contain at least one uppercase letter").regex(/[a-z]/, "Password must contain at least one lowercase letter").regex(/[0-9]/, "Password must contain at least one number") });
const emailInput = z.object({ email: z.string().trim().toLowerCase().email() });
const otpInput = z.object({ email: z.string().trim().toLowerCase().email(), challenge: z.string().min(20), code: z.string().regex(/^\d{6}$/) });

async function hashPassword(password: string) { const salt = randomBytes(16); const derived = (await scrypt(password, salt, 64)) as Buffer; return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`; }
async function verifyPassword(password: string, encoded: string) { const [scheme, saltHex, hashHex] = encoded.split("$"); if (scheme !== "scrypt" || !saltHex || !hashHex) return false; const derived = (await scrypt(password, Buffer.from(saltHex, "hex"), 64)) as Buffer; const expected = Buffer.from(hashHex, "hex"); return expected.length === derived.length && timingSafeEqual(expected, derived); }

function publicWebOrigin(req: import("express").Request) {
  const origin = req.get("origin")?.trim();
  if (origin) {
    try { return new URL(origin).origin; } catch { /* fall through */ }
  }
  return env.WEB_ORIGIN.replace(/\/$/, "");
}

function setUserSessionCookie(res: import("express").Response, token: string) {
  res.cookie(USER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production" && env.WEB_ORIGIN.startsWith("https://"),
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

function clearUserSessionCookie(res: import("express").Response) {
  res.clearCookie(USER_SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: env.NODE_ENV === "production" && env.WEB_ORIGIN.startsWith("https://"), path: "/" });
}

async function sendVerificationForUser(userId: string, email: string, req: import("express").Request) {
  const verificationToken = createEmailVerificationToken(userId, email, null);
  const verificationUrl = `${publicWebOrigin(req)}/verify-email?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(email)}`;
  await sendEmailVerification(email, verificationUrl);
}

router.post("/register", registerRateLimiter, async (req, res, next) => {
  try {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) { const passwordErrors = parsed.error.issues.filter((issue) => issue.path.includes("password")); const message = passwordErrors.length > 0 && passwordErrors[0] ? passwordErrors[0].message : "Use a valid email and a password that meets the requirements."; return res.status(400).json({ success: false, message }); }
    const email = parsed.data.email;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ success: false, message: "An account with that email already exists." });
    const displayName = email.split("@")[0] ?? null;
    const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword(parsed.data.password), status: "PENDING", emailVerifiedAt: null, displayName } });
    try { await sendVerificationForUser(user.id, email, req); } catch (error) { console.error("Initial email verification delivery failed:", error); return res.status(503).json({ success: false, emailVerificationRequired: true, message: "Your account was created, but we could not send the verification email. Please use Resend Verification Email after the email service is available." }); }
    logRegistration(user.id, req).catch(console.error);
    return res.status(201).json({ success: true, user, emailVerificationRequired: true, email });
  } catch (e) { next(e); }
});

router.post("/email/resend-verification", verificationResendRateLimiter, async (req, res, next) => {
  try {
    const parsed = emailInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Enter a valid email address." });
    const email = parsed.data.email;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt || user.status === "BANNED" || user.status === "DELETED") return res.status(404).json({ success: false, message: "No pending account was found for this email." });
    if (user.emailVerifiedAt) return res.json({ success: true, verified: true, message: "This email is already verified. You can log in." });
    await sendVerificationForUser(user.id, email, req);
    return res.json({ success: true, verified: false, message: "A new verification link has been sent. Check your inbox and spam folder." });
  } catch (e) { console.error("Verification email resend failed:", e); return res.status(503).json({ success: false, message: "We could not send the verification email right now. Please try again later." }); }
});

router.post("/login", loginRateLimiter, async (req, res, next) => {
  try {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Email and password are required." });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !user.passwordHash || ["BANNED", "DELETED", "SUSPENDED"].includes(user.status) || !(await verifyPassword(parsed.data.password, user.passwordHash))) { logLoginFailed(parsed.data.email, "invalid_credentials", req).catch(console.error); return res.status(401).json({ success: false, message: "Invalid email or password." }); }
    if (!user.emailVerifiedAt) { logLoginFailed(parsed.data.email, "email_not_verified", req).catch(console.error); return res.status(403).json({ success: false, message: "Verify your email before signing in.", emailVerificationRequired: true }); }
    const token = await createAuthToken(user.id);
    setUserSessionCookie(res, token);
    logLoginSuccess(user.id, req).catch(console.error);
    return res.json({ success: true, token, user });
  } catch (e) { next(e); }
});

router.get("/me", requireAuth, async (req, res, next) => { try { if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" }); const user = await prisma.user.findUnique({ where: { id: req.userId } }); if (!user) return res.status(404).json({ success: false, message: "User not found" }); return res.json({ success: true, user }); } catch (e) { next(e); } });
router.post("/logout", requireAuth, async (req, res, next) => { try { if (req.userId) logLogout(req.userId, req).catch(console.error); clearUserSessionCookie(res); return res.json({ success: true, message: "Logged out successfully" }); } catch (e) { next(e); } });

router.post("/email/request-verification", requireAuth, otpRequestRateLimiter, async (req, res, next) => { try { if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" }); const parsed = emailInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ success: false, message: "Enter a valid email address." }); const email = parsed.data.email; const user = await prisma.user.findUnique({ where: { id: req.userId } }); if (!user) return res.status(404).json({ success: false, message: "User not found" }); if (user.email === email && user.emailVerifiedAt) return res.json({ success: true, verified: true, message: "Email is already verified." }); const conflict = await prisma.user.findUnique({ where: { email } }); if (conflict && conflict.id !== user.id) return res.status(409).json({ success: false, message: "That email is already attached to another Raven Oracle account." }); const { code, challenge } = createOtpChallenge(user.id, email); await sendEmailOtp(email, code); await prisma.user.update({ where: { id: user.id }, data: { email, emailVerifiedAt: null } }); logOtpRequest(user.id, req).catch(console.error); return res.json({ success: true, verified: false, challenge, message: "A 6-digit OTP was sent from Raven Oracle to your email." }); } catch (e) { next(e); } });
router.post("/email/verify-otp", requireAuth, otpVerifyRateLimiter, async (req, res, next) => { try { if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" }); const parsed = otpInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ success: false, message: "Enter the 6-digit OTP." }); const email = parsed.data.email; try { verifyOtpChallenge(parsed.data.challenge, req.userId, email, parsed.data.code); } catch (e) { const message = e instanceof Error ? e.message : "OTP verification failed"; logOtpVerificationFailed(req.userId, message, req).catch(console.error); return res.status(400).json({ success: false, message }); } const user = await prisma.user.update({ where: { id: req.userId }, data: { email, emailVerifiedAt: new Date(), status: "ACTIVE" } }); const token = await createAuthToken(user.id); setUserSessionCookie(res, token); logOtpVerificationSuccess(user.id, req).catch(console.error); return res.json({ success: true, token, user, message: "Email verified successfully." }); } catch (e) { const message = e instanceof Error ? e.message : "OTP verification failed"; return res.status(400).json({ success: false, message }); } });

router.post("/email/verify", async (req, res, next) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    let data;
    try { data = verifyEmailVerificationToken(token); } catch (e) { const message = e instanceof Error ? e.message : "Email verification failed"; logEmailVerificationFailed(message, req).catch(console.error); return res.status(400).json({ success: false, message }); }
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) { logEmailVerificationFailed("Account not found", req).catch(console.error); return res.status(404).json({ success: false, message: "Account not found." }); }
    if (user.emailVerifiedAt) { logEmailVerificationFailed("Email already verified", req).catch(console.error); return res.status(409).json({ success: false, message: "This verification link has already been used. You can log in." }); }
    if (user.email !== null && user.email !== data.email) { logEmailVerificationFailed("Verification link no longer valid", req).catch(console.error); return res.status(409).json({ success: false, message: "This verification link is no longer valid." }); }
    const updated = await prisma.user.update({ where: { id: user.id }, data: { email: data.email, emailVerifiedAt: new Date(), status: "ACTIVE" } });
    logEmailVerificationSuccess(updated.id, req).catch(console.error);
    return res.json({ success: true, message: "Email verified successfully. You can now log in." });
  } catch (e) { const message = e instanceof Error ? e.message : "Email verification failed"; return res.status(400).json({ success: false, message }); }
});

export default router;
