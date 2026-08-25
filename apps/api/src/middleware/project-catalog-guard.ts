import type { NextFunction, Request, Response } from "express";
import { requireAdminAuth } from "./auth.js";

const LEGACY_CATEGORIES = new Set(["GAME", "TOOL", "DEFI", "COMMUNITY"]);

function isLegacy(value: unknown) {
  return typeof value === "string" && LEGACY_CATEGORIES.has(value.trim().toUpperCase());
}

export async function projectCatalogGuard(req: Request, res: Response, next: NextFunction) {
  const queryCategory = typeof req.query.category === "string" ? req.query.category : undefined;
  const bodyCategory = req.body && typeof req.body === "object" ? req.body.category : undefined;

  if (isLegacy(queryCategory) || isLegacy(bodyCategory)) {
    return res.status(400).json({
      success: false,
      message: "Legacy project categories are no longer supported. Use NFT only for the current project catalog.",
    });
  }

  // NFT project creation is admin-only. Public project discovery/reads remain open.
  if (req.method === "POST" && req.path === "/") {
    return requireAdminAuth(req, res, next);
  }

  return next();
}
