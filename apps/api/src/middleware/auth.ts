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

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : cookieToken(req);

    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const user = await verifyAuthToken(token);
    if (!user || user.status === "BANNED" || user.deletedAt) {
      return res.status(401).json({ success: false, message: "Invalid authentication" });
    }

    req.userId = user.id;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid authentication token" });
  }
}
