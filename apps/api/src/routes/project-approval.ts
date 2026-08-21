import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getProjectApprovalReadiness } from "../services/project-approval.service.js";
import { logProjectModeration } from "../services/audit-log.service.js";

const router = Router();

async function requireAdminUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true, isAdminApproved: true },
  });
}

async function assertAdmin(userId: string) {
  const admin = await requireAdminUser(userId);
  return !!admin && admin.status !== "BANNED" && ["ADMIN", "MODERATOR"].includes(admin.role) && admin.isAdminApproved;
}

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, select: { submittedByUserId: true } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    if (project.submittedByUserId !== req.userId) return res.status(403).json({ success: false, message: "You do not own this project" });
    const result = await getProjectApprovalReadiness(req.params.id);
    if (!result.project) return res.status(404).json(result);
    return res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

router.get("/admin/:id", (req, res, next) => requireAuth(req, res, next, "admin"), async (req, res, next) => {
  try {
    if (!req.userId || !(await assertAdmin(req.userId))) return res.status(403).json({ success: false, message: "Admin access required" });
    const result = await getProjectApprovalReadiness(req.params.id);
    if (!result.project) return res.status(404).json(result);
    return res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

router.post("/:id/approve", (req, res, next) => requireAuth(req, res, next, "admin"), async (req, res, next) => {
  try {
    if (!req.userId || !(await assertAdmin(req.userId))) return res.status(403).json({ success: false, message: "Admin access required" });
    const readiness = await getProjectApprovalReadiness(req.params.id);
    if (!readiness.project) return res.status(404).json(readiness);
    if (!readiness.ready) {
      const reasons = readiness.issues.map((issue) => `${issue.field}: ${issue.message}`).join(" | ");
      return res.status(422).json({ success: false, message: `Project is not ready for approval. ${reasons}`, issues: readiness.issues, readiness });
    }
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, deletedAt: true } });
    if (!project || project.deletedAt) return res.status(404).json({ success: false, message: "Project not found" });
    if (project.status === "APPROVED") return res.json({ success: true, message: "Project is already approved", readiness });
    const updated = await prisma.project.update({ where: { id: project.id }, data: { status: "APPROVED", approvedAt: new Date(), approvedByUserId: req.userId, rejectedAt: null, rejectionReason: null } });
    await logProjectModeration(req.userId, project.id, "PROJECT_APPROVED", { status: project.status }, { status: updated.status });
    return res.json({ success: true, project: updated, readiness });
  } catch (error) { next(error); }
});

router.post("/:id/reject", (req, res, next) => requireAuth(req, res, next, "admin"), async (req, res, next) => {
  try {
    if (!req.userId || !(await assertAdmin(req.userId))) return res.status(403).json({ success: false, message: "Admin access required" });
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (reason.length < 5 || reason.length > 1000) return res.status(400).json({ success: false, message: "A rejection reason between 5 and 1000 characters is required." });
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, deletedAt: true, submittedByUserId: true } });
    if (!project || project.deletedAt) return res.status(404).json({ success: false, message: "Project not found" });
    if (project.status === "APPROVED") return res.status(409).json({ success: false, message: "Approved projects must use the dedicated edit/review workflow." });
    const updated = await prisma.project.update({ where: { id: project.id }, data: { status: "REJECTED", rejectedAt: new Date(), rejectionReason: reason, approvedAt: null, approvedByUserId: null } });
    await logProjectModeration(req.userId, project.id, "PROJECT_REJECTED", { status: project.status }, { status: updated.status, rejectionReason: reason });
    return res.json({ success: true, project: updated });
  } catch (error) { next(error); }
});

router.post("/:id/resubmit", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, deletedAt: true, submittedByUserId: true } });
    if (!project || project.deletedAt) return res.status(404).json({ success: false, message: "Project not found" });
    if (project.submittedByUserId !== req.userId) return res.status(403).json({ success: false, message: "You do not own this project" });
    if (project.status !== "REJECTED") return res.status(409).json({ success: false, message: "Only rejected projects can be resubmitted." });
    const readiness = await getProjectApprovalReadiness(project.id);
    if (!readiness.ready) return res.status(422).json({ success: false, message: "Project is not ready for resubmission.", issues: readiness.issues, readiness });
    const updated = await prisma.project.update({ where: { id: project.id }, data: { status: "SUBMITTED", rejectedAt: null, rejectionReason: null, approvedAt: null, approvedByUserId: null } });
    return res.json({ success: true, project: updated, readiness });
  } catch (error) { next(error); }
});

export default router;
