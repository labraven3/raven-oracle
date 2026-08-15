import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../services/auth.service.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = header.slice("Bearer ".length).trim();
    const user = await verifyAuthToken(token);

    if (!user || user.status === "BANNED" || user.deletedAt) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication",
      });
    }

    req.userId = user.id;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
  }
}
