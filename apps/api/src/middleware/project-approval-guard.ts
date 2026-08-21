import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "./auth.js";
import { getProjectApprovalReadiness } from "../services/project-approval.service.js";

export async function projectApprovalGuard(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "PATCH" || !req.path.match(/^\/projects\/[^/]+$/) || req.body?.status !== "APPROVED") return next();

  return requireAuth(req, res, async () => {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const readiness = await getProjectApprovalReadiness(req.params.id);
    if (!readiness.project) return res.status(404).json(readiness);
    if (!readiness.ready) {
      const reasons = readiness.issues.map((issue) => `${issue.field}: ${issue.message}`).join(" | ");
      return res.status(422).json({ success: false, message: `Project is not ready for approval. ${reasons}`, issues: readiness.issues, readiness });
    }
    return next();
  }, "admin");
}
