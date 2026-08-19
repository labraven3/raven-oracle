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

/**
 * Admin authentication is deliberately separate from normal user login.
 * A successful request issues an admin-scoped JWT only when the account has
 * both an ADMIN/MODERATOR role and explicit admin approval.
 */
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
      return res.status(403).json({ success: false, message: "Verify your email before signing in." });
    }

    if (!["ADMIN", "MODERATOR"].includes(user.role)) {
      logLoginFailed(parsed.data.email, "not_admin", req).catch(console.error);
      return res.status(403).json({ success: false, message: "Admin access required." });
    }

    if (!user.isAdminApproved) {
      logLoginFailed(parsed.data.email, "admin_not_approved", req).catch(console.error);
      return res.status(403).json({
        success: false,
        message: "Admin access pending approval. Please contact the administrator.",
      });
    }

    const token = await createAuthToken(user.id, "admin");
    logLoginSuccess(user.id, req).catch(console.error);
    return res.json({ success: true, token, user });
  } catch (e) {
    next(e);
  }
});

export default router;
