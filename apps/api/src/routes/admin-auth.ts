import { Router } from "express";
import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { createAuthToken } from "../services/auth.service.js";
import { logLoginFailed, logLoginSuccess } from "../services/auth-audit.service.js";

const router = Router();
const scrypt = promisify(scryptCallback);

const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again later." },
  skipSuccessfulRequests: true,
});

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

async function verifyPassword(password: string, encoded: string) {
  const [scheme, saltHex, hashHex] = encoded.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const derived = (await scrypt(password, Buffer.from(saltHex, "hex"), 64)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

/** Admin login is separate from normal user login and always issues an admin-scoped JWT. */
router.post("/login", adminLoginRateLimiter, async (req, res, next) => {
  try {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    const validPassword = !!user?.passwordHash && await verifyPassword(parsed.data.password, user.passwordHash);

    if (!user || !validPassword || ["BANNED", "DELETED", "SUSPENDED"].includes(user.status)) {
      logLoginFailed(parsed.data.email, "invalid_admin_credentials", req).catch(console.error);
      return res.status(401).json({ success: false, message: "Invalid admin credentials." });
    }

    if (!user.emailVerifiedAt) {
      logLoginFailed(parsed.data.email, "admin_email_not_verified", req).catch(console.error);
      return res.status(403).json({ success: false, message: "Verify your admin email before signing in." });
    }

    if (!["ADMIN", "MODERATOR"].includes(user.role)) {
      logLoginFailed(parsed.data.email, "not_admin", req).catch(console.error);
      return res.status(403).json({ success: false, message: "Admin access required." });
    }

    // ADMIN is the bootstrap authority and therefore is always approved.
    // MODERATOR accounts still require explicit approval.
    if (user.role === "ADMIN" && !user.isAdminApproved) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isAdminApproved: true, adminApprovedAt: new Date() },
      });
    }

    if (user.role === "MODERATOR" && !user.isAdminApproved) {
      logLoginFailed(parsed.data.email, "admin_not_approved", req).catch(console.error);
      return res.status(403).json({ success: false, message: "Moderator access pending approval." });
    }

    const token = await createAuthToken(user.id, "admin");
    logLoginSuccess(user.id, req).catch(console.error);

    // Never send passwordHash (or any credential material) to the browser.
    const safeUser = Object.fromEntries(
      Object.entries(user).filter(([key]) => key !== "passwordHash")
    );
    safeUser.isAdminApproved = true;

    return res.json({ success: true, token, user: safeUser });
  } catch (e) {
    next(e);
  }
});

export default router;
