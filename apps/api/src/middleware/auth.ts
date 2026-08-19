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

function cookieToken(req: Request, portal: AuthPortal) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const cookieName = portal === "admin" ? "raven_admin_token" : "raven_token";
  const match = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  return match ? decodeURIComponent(match.slice(`${cookieName}=`.length)) : null;
}

function portalForRequest(req: Request): AuthPortal {
  const url = req.originalUrl || req.baseUrl || req.url;
  return url === "/api/admin" || url.startsWith("/api/admin/") ? "admin" : "user";
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
  portal?: AuthPortal
) {
  try {
    const expectedPortal = portal ?? portalForRequest(req);
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : cookieToken(req, expectedPortal);

    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const user = await verifyAuthToken(token, expectedPortal);

    if (!user || user.status === "BANNED" || user.deletedAt) {
      return res.status(401).json({ success: false, message: "Invalid authentication" });
    }

    req.userId = user.id;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid authentication token" });
  }
}

export async function requireUserAuth(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, next, "user");
}

export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, next, "admin");
}

export async function requireActiveAccount(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : cookieToken(req, "user");
    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const user = await verifyAuthToken(token, "user");

    if (!user) return res.status(401).json({ success: false, message: "User not found" });
    if (user.status === "SUSPENDED") return res.status(403).json({ success: false, message: "Your account has been suspended. Please contact support." });
    if (user.status === "PENDING") return res.status(403).json({ success: false, message: "Please verify your email to access this feature." });
    if (user.status === "BANNED" || user.status === "DELETED") return res.status(403).json({ success: false, message: "Access denied." });
    if (user.status !== "ACTIVE") return res.status(403).json({ success: false, message: "Your account is not active." });

    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid authentication token" });
  }
}
