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

async function resolveUserFromRequest(req: Request, portal: AuthPortal) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : null;
  const cookie = cookieToken(req, portal);

  // Prefer the explicit bearer token, but fall back to the same-origin session
  // cookie. This keeps auth stable when a browser has an old local token while
  // the server has already issued a fresh session cookie.
  if (bearer) {
    try {
      const user = await verifyAuthToken(bearer, portal);
      if (user) return user;
    } catch {
      // Fall through to the session cookie below.
    }
  }

  if (cookie) {
    try {
      return await verifyAuthToken(cookie, portal);
    } catch {
      return null;
    }
  }

  return null;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
  portal?: AuthPortal
) {
  try {
    const expectedPortal = portal ?? portalForRequest(req);
    const hasCredentials = Boolean(req.headers.authorization?.startsWith("Bearer ")) || Boolean(cookieToken(req, expectedPortal));

    if (!hasCredentials) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const user = await resolveUserFromRequest(req, expectedPortal);

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
    const bearer = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : null;
    const token = bearer || cookieToken(req, "user");
    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    let user;
    try {
      user = await verifyAuthToken(token, "user");
    } catch {
      const cookie = cookieToken(req, "user");
      if (!cookie || cookie === token) return res.status(401).json({ success: false, message: "Invalid authentication token" });
      user = await verifyAuthToken(cookie, "user");
    }

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
