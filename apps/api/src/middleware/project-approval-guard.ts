import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "./auth.js";
import { getProjectApprovalReadiness } from "../services/project-approval.service.js";

export async function projectApprovalGuard(req: Request, res: Response, next: NextFunction) {
  const match = req.path.match(/^\/projects\/([^/]+)$/);
  if (req.method !== "PATCH" || !match || req.body?.status !== "APPROVED") return next();

  const projectId = match[1];
  if (!projectId) return res.status(400).json({ success: false, message: "Invalid project ID" });

  return requireAuth(req, res, async () => {
    try {
      if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
      const readiness = await getProjectApprovalReadiness(projectId);
      if (!readiness.project) return res.status(404).json(readiness);
      if (!readiness.ready) {
        const reasons = readiness.issues.map((issue) => `${issue.field}: ${issue.message}`).join(" | ");
        return res.status(422).json({ success: false, message: `Project is not ready for approval. ${reasons}`, issues: readiness.issues, readiness });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  }, "admin");
}
