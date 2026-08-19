import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../middleware/auth.js";
import {
  logAlphaModeration,
  logProjectModeration,
  logPointsTransaction,
} from "../services/audit-log.service.js";

const router = Router();

async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.userId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { role: true, status: true, isAdminApproved: true },
  });

  if (!user || user.status === "BANNED" || !["ADMIN", "MODERATOR"].includes(user.role)) {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }

  if (!user.isAdminApproved) {
    return res.status(403).json({
      success: false,
      message: "Admin access pending approval. Please contact the administrator.",
    });
  }

  next();
}

router.use(requireAdminAuth, requireAdmin);

router.get("/overview", async (_req, res, next) => {
  try {
    const [submittedProjects, approvedProjects, activeRaffles, entries, users, pendingAlpha] = await Promise.all([
      prisma.project.count({ where: { status: "SUBMITTED", deletedAt: null } }),
      prisma.project.count({ where: { status: "APPROVED", deletedAt: null } }),
      prisma.raffle.count({ where: { status: { in: ["SCHEDULED", "ACTIVE"] }, cancelledAt: null } }),
      prisma.raffleEntry.count(),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.alphaSubmission.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, deletedAt: null } }),
    ]);
    res.json({ success: true, stats: { submittedProjects, approvedProjects, activeRaffles, entries, users, pendingAlpha } });
  } catch (e) { next(e); }
});

router.get("/projects", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const allowed = ["SUBMITTED", "APPROVED", "REJECTED", "ARCHIVED"] as const;
    const where = status && (allowed as readonly string[]).includes(status)
      ? { status: status as (typeof allowed)[number], deletedAt: null }
      : { deletedAt: null };
    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, name: true, slug: true, description: true, logoUrl: true,
        websiteUrl: true, xUrl: true, discordUrl: true, category: true,
        status: true, rejectionReason: true, createdAt: true,
      },
    });
    res.json({ success: true, projects });
  } catch (e) { next(e); }
});

router.patch("/projects/:id", async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const parsed = z.object({
      status: z.enum(["APPROVED", "REJECTED", "ARCHIVED"]),
      rejectionReason: z.string().trim().max(1000).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid moderation data" });
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project || project.deletedAt) return res.status(404).json({ success: false, message: "Project not found" });
    const beforeStatus = project.status;
    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        status: parsed.data.status,
        approvedAt: parsed.data.status === "APPROVED" ? new Date() : null,
        approvedByUserId: parsed.data.status === "APPROVED" ? req.userId : null,
        rejectedAt: parsed.data.status === "REJECTED" ? new Date() : null,
        rejectionReason: parsed.data.status === "REJECTED" ? parsed.data.rejectionReason || "Rejected by moderator" : null,
      },
    });
    if (parsed.data.status === "APPROVED") {
      await logProjectModeration(req.userId, project.id, "PROJECT_APPROVED", { status: beforeStatus }, { status: updated.status });
    } else if (parsed.data.status === "REJECTED") {
      await logProjectModeration(req.userId, project.id, "PROJECT_REJECTED", { status: beforeStatus }, { status: updated.status, rejectionReason: updated.rejectionReason });
    }
    res.json({ success: true, project: updated });
  } catch (e) { next(e); }
});

router.get("/raffles", async (_req, res, next) => {
  try {
    const raffles = await prisma.raffle.findMany({
      orderBy: { createdAt: "desc" }, take: 200,
      include: {
        project: { select: { name: true, logoUrl: true } },
        createdBy: { select: { email: true, username: true } },
        _count: { select: { entries: true, winners: true, tasks: true } },
      },
    });
    res.json({ success: true, raffles });
  } catch (e) { next(e); }
});

router.get("/alpha", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "SUBMITTED";
    const statuses = ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "REJECTED", "DUPLICATE", "ARCHIVED"];
    const submissions = await prisma.alphaSubmission.findMany({
      where: { deletedAt: null, ...(statuses.includes(status) ? { status: status as never } : {}) },
      orderBy: { createdAt: "asc" }, take: 200,
      include: {
        submittedBy: { select: { id: true, username: true, displayName: true } },
        project: { select: { id: true, name: true } },
      },
    });
    res.json({ success: true, submissions });
  } catch (e) { next(e); }
});

router.patch("/alpha/:id", async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const parsed = z.object({
      status: z.enum(["UNDER_REVIEW", "VERIFIED", "REJECTED", "DUPLICATE", "ARCHIVED"]),
      rejectionReason: z.string().trim().max(1000).optional(),
      points: z.number().int().min(0).max(10000).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid alpha moderation data" });
    const submission = await prisma.alphaSubmission.findUnique({ where: { id: req.params.id } });
    if (!submission || submission.deletedAt) return res.status(404).json({ success: false, message: "Alpha submission not found" });
    const points = parsed.data.status === "VERIFIED" ? (parsed.data.points ?? 100) : 0;
    const alreadyAwarded = submission.pointsAwarded !== null;
    const beforeStatus = submission.status;
    const beforePoints = submission.pointsAwarded;
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.alphaSubmission.update({
        where: { id: submission.id },
        data: {
          status: parsed.data.status, reviewedByUserId: req.userId, reviewedAt: new Date(),
          rejectionReason: parsed.data.status === "REJECTED" || parsed.data.status === "DUPLICATE" ? parsed.data.rejectionReason ?? "Rejected by moderator" : null,
          pointsAwarded: parsed.data.status === "VERIFIED" ? points : null,
        },
      });
      if (parsed.data.status === "VERIFIED" && points > 0 && !alreadyAwarded) {
        await tx.pointTransaction.create({
          data: {
            userId: submission.submittedByUserId, amount: points, type: "ALPHA_VERIFIED",
            reason: `Verified alpha: ${submission.title}`, alphaSubmissionId: submission.id,
            createdByUserId: req.userId,
          },
        });
      }
      return row;
    });
    if (parsed.data.status === "VERIFIED") {
      await logAlphaModeration(req.userId, submission.id, "ALPHA_VERIFIED", { status: beforeStatus, pointsAwarded: beforePoints }, { status: updated.status, pointsAwarded: updated.pointsAwarded });
      if (points > 0 && !alreadyAwarded) await logPointsTransaction(req.userId, submission.submittedByUserId, points, "POINTS_AWARDED", `Verified alpha: ${submission.title}`, "AlphaSubmission", submission.id);
    } else if (parsed.data.status === "REJECTED" || parsed.data.status === "DUPLICATE") {
      await logAlphaModeration(req.userId, submission.id, "ALPHA_REJECTED", { status: beforeStatus, pointsAwarded: beforePoints }, { status: updated.status, pointsAwarded: updated.pointsAwarded, rejectionReason: updated.rejectionReason });
    }
    res.json({ success: true, submission: updated });
  } catch (e) { next(e); }
});

router.get("/audit-logs", async (req, res, next) => {
  try {
    const action = typeof req.query.action === "string" ? req.query.action : undefined;
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
    const where: { action?: never; entityType?: string } = {};
    if (action) where.action = action as never;
    if (entityType) where.entityType = entityType;
    const logs = await prisma.auditLog.findMany({
      where, orderBy: { createdAt: "desc" }, take: 200,
      include: { actor: { select: { id: true, username: true, displayName: true, role: true } } },
    });
    res.json({ success: true, logs });
  } catch (e) { next(e); }
});

router.get("/users", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const role = typeof req.query.role === "string" ? req.query.role : undefined;
    const where: { deletedAt: null; status?: never; role?: never } = { deletedAt: null };
    if (status && ["PENDING", "ACTIVE", "SUSPENDED", "BANNED"].includes(status)) where.status = status as never;
    if (role && ["USER", "MODERATOR", "ADMIN"].includes(role)) where.role = role as never;
    const users = await prisma.user.findMany({
      where, orderBy: { createdAt: "desc" }, take: 200,
      select: {
        id: true, email: true, username: true, displayName: true, role: true, status: true,
        emailVerifiedAt: true, createdAt: true, updatedAt: true,
        _count: { select: { raffleEntries: true, alphaSubmissions: true, chatMessages: true, walletAddresses: true } },
      },
    });
    res.json({ success: true, users });
  } catch (e) { next(e); }
});

router.patch("/users/:id/status", async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const parsed = z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]), reason: z.string().trim().max(1000).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid user status data" });
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, role: true, deletedAt: true } });
    if (!user || user.deletedAt) return res.status(404).json({ success: false, message: "User not found" });
    const actor = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
    if (["ADMIN", "MODERATOR"].includes(user.role) && actor?.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Only administrators can modify admin or moderator accounts." });
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data: { status: parsed.data.status } });
    if (parsed.data.status === "SUSPENDED") await logProjectModeration(req.userId, user.id, "USER_SUSPENDED", { status: user.status }, { status: updated.status });
    if (parsed.data.status === "BANNED") await logProjectModeration(req.userId, user.id, "USER_BANNED", { status: user.status }, { status: updated.status });
    res.json({ success: true, user: updated });
  } catch (e) { next(e); }
});

export default router;
