import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../services/auth.service.js";

type AuthPortal = "user" | "admin";

declare global {
  namespace Express {
    interface Request { userId?: string; }
  }
}

function getToken(req: Request, portal: AuthPortal) {
  const auth = req.headers.authorization;
  if (typeof auth === "string") {
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) return match[1].trim();
  }
  const raw = req.headers.cookie;
  if (typeof raw === "string") {
    const name = portal === "admin" ? "raven_admin_token" : "raven_token";
    const part = raw.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${name}=`));
    if (part) return decodeURIComponent(part.slice(name.length + 1));
  }
  return null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction, portal: AuthPortal = "user") {
  try {
    const token = getToken(req, portal);
    if (!token) return res.status(401).json({ success: false, message: "Authentication required" });
    const user = await verifyAuthToken(token, portal);
    if (!user || user.status === "BANNED" || user.deletedAt) return res.status(401).json({ success: false, message: "Invalid authentication" });
    req.userId = user.id;
    return next();
  } catch (error) {
    console.error("[auth] verification failed:", error instanceof Error ? error.message : error);
    return res.status(401).json({ success: false, message: "Invalid authentication token" });
  }
}

export async function requireUserAuth(req: Request, res: Response, next: NextFunction) { return requireAuth(req, res, next, "user"); }
export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) { return requireAuth(req, res, next, "admin"); }

export async function requireActiveAccount(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const token = getToken(req, "user");
    if (!token) return res.status(401).json({ success: false, message: "Authentication required" });
    const user = await verifyAuthToken(token, "user");
    if (!user) return res.status(401).json({ success: false, message: "User not found" });
    if (user.status === "SUSPENDED") return res.status(403).json({ success: false, message: "Your account has been suspended. Please contact support." });
    if (user.status === "PENDING") return res.status(403).json({ success: false, message: "Please verify your email to access this feature." });
    if (user.status === "BANNED" || user.status === "DELETED") return res.status(403).json({ success: false, message: "Access denied." });
    if (user.status !== "ACTIVE") return res.status(403).json({ success: false, message: "Your account is not active." });
    return next();
  } catch (error) {
    console.error("[auth] active-account verification failed:", error instanceof Error ? error.message : error);
    return res.status(401).json({ success: false, message: "Invalid authentication token" });
  }
}
