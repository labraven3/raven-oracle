import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { loginRateLimiter, otpRequestRateLimiter, otpVerifyRateLimiter, verificationResendRateLimiter } from "../middleware/rate-limit.js";
import { clearUserSessionCookie, setUserSessionCookie } from "../services/session.service.js";
import { createAuthToken } from "../services/auth-token.service.js";
import { hashPassword, verifyPassword } from "../services/password.service.js";
import { sendEmailOtp, sendVerificationForUser } from "../services/email.service.js";
import { createOtpChallenge, verifyOtpChallenge } from "../services/otp.service.js";
import { verifyEmailVerificationToken } from "../services/email-verification.service.js";
import { logEmailVerificationFailed, logEmailVerificationSuccess, logLoginFailed, logLoginSuccess, logLogout, logOtpRequest, logOtpVerificationFailed, logOtpVerificationSuccess } from "../services/audit.service.js";

const router = Router();
const credentials = z.object({ email: z.string().email(), password: z.string().min(1) });
const emailInput = z.object({ email: z.string().email() });
const otpInput = z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/), challenge: z.string().min(1) });

function publicUser<T extends { passwordHash?: string | null }>(user: T) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

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
    return res.json({ success: true, token, user: publicUser(user) });
  } catch (e) { next(e); }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, user: publicUser(user) });
  } catch (e) { next(e); }
});

router.post("/logout", requireAuth, async (req, res, next) => { try { if (req.userId) logLogout(req.userId, req).catch(console.error); clearUserSessionCookie(res); return res.json({ success: true, message: "Logged out successfully" }); } catch (e) { next(e); } });

router.post("/email/request-verification", requireAuth, otpRequestRateLimiter, async (req, res, next) => { try { if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" }); const parsed = emailInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ success: false, message: "Enter a valid email address." }); const email = parsed.data.email; const user = await prisma.user.findUnique({ where: { id: req.userId } }); if (!user) return res.status(404).json({ success: false, message: "User not found" }); if (user.email === email && user.emailVerifiedAt) return res.json({ success: true, verified: true, message: "Email is already verified." }); const conflict = await prisma.user.findUnique({ where: { email } }); if (conflict && conflict.id !== user.id) return res.status(409).json({ success: false, message: "That email is already attached to another Raven Oracle account." }); const { code, challenge } = createOtpChallenge(user.id, email); await sendEmailOtp(email, code); await prisma.user.update({ where: { id: user.id }, data: { email, emailVerifiedAt: null } }); logOtpRequest(user.id, req).catch(console.error); return res.json({ success: true, verified: false, challenge, message: "A 6-digit OTP was sent from Raven Oracle to your email." }); } catch (e) { next(e); } });
router.post("/email/verify-otp", requireAuth, otpVerifyRateLimiter, async (req, res, next) => { try { if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" }); const parsed = otpInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ success: false, message: "Enter the 6-digit OTP." }); const email = parsed.data.email; try { verifyOtpChallenge(parsed.data.challenge, req.userId, email, parsed.data.code); } catch (e) { const message = e instanceof Error ? e.message : "OTP verification failed"; logOtpVerificationFailed(req.userId, message, req).catch(console.error); return res.status(400).json({ success: false, message }); } const user = await prisma.user.update({ where: { id: req.userId }, data: { email, emailVerifiedAt: new Date(), status: "ACTIVE" } }); const token = await createAuthToken(user.id); setUserSessionCookie(res, token); logOtpVerificationSuccess(user.id, req).catch(console.error); return res.json({ success: true, token, user: publicUser(user), message: "Email verified successfully." }); } catch (e) { const message = e instanceof Error ? e.message : "OTP verification failed"; return res.status(400).json({ success: false, message }); } });

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
