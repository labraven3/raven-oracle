import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../services/auth.service.js";

type AuthPortal = "user" | "admin";

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
  const match = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("raven_token="));
  return match ? decodeURIComponent(match.slice("raven_token=".length)) : null;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
  portal: AuthPortal = "user"
) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : cookieToken(req);

    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const user = await verifyAuthToken(token, portal);

    if (!user || user.status === "BANNED" || user.deletedAt) {
      return res.status(401).json({ success: false, message: "Invalid authentication" });
    }

    req.userId = user.id;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid authentication token" });
  }
}

/** Standard user-session middleware. */
export async function requireUserAuth(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, next, "user");
}

/** Admin-session middleware. Role/approval is still checked by requireAdmin. */
export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, next, "admin");
}

/**
 * Middleware to check if user account is active.
 * Must be used after requireUserAuth/requireAdminAuth.
 */
export async function requireActiveAccount(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : cookieToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const user = await verifyAuthToken(token, "user");

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    if (user.status === "SUSPENDED") {
      return res.status(403).json({ success: false, message: "Your account has been suspended. Please contact support." });
    }
    if (user.status === "PENDING") {
      return res.status(403).json({ success: false, message: "Please verify your email to access this feature." });
    }
    if (user.status === "BANNED" || user.status === "DELETED") {
      return res.status(403).json({ success: false, message: "Access denied." });
    }
    if (user.status !== "ACTIVE") {
      return res.status(403).json({ success: false, message: "Your account is not active." });
    }

    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid authentication token" });
  }
}
