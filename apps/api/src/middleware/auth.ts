import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../services/auth.service.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function cookieToken(req: Request) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const match = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith("raven_token="));
  return match ? decodeURIComponent(match.slice("raven_token=".length)) : null;
}

/**
 * Authentication middleware that requires a valid JWT token.
 * 
 * Extracts token from:
 * 1. Authorization header (Bearer token)
 * 2. Cookie (raven_token)
 * 
 * Security checks:
 * - Token signature validity
 * - Token expiration
 * - User existence
 * - User account status (not banned/deleted)
 * 
 * Returns generic error messages to prevent information leakage.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : cookieToken(req);

    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Verify token (throws on invalid/expired/malformed tokens)
    const user = await verifyAuthToken(token);
    
    // Check if user exists and is in good standing
    if (!user || user.status === "BANNED" || user.deletedAt) {
      return res.status(401).json({ success: false, message: "Invalid authentication" });
    }

    req.userId = user.id;
    next();
  } catch (error) {
    // Use generic error message to prevent information leakage
    // (Don't reveal whether token is expired, malformed, wrong secret, etc.)
    return res.status(401).json({ success: false, message: "Invalid authentication token" });
  }
}
