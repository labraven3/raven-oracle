import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true, status: true } });
  if (!user || user.status === "BANNED" || !["ADMIN", "MODERATOR"].includes(user.role)) {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
}

router.use(requireAuth, requireAdmin);

router.get("/overview", async (_req, res, next) => {
  try {
    const [submittedProjects, approvedProjects, activeRaffles, entries, users] = await Promise.all([
      prisma.project.count({ where: { status: "SUBMITTED", deletedAt: null } }),
      prisma.project.count({ where: { status: "APPROVED", deletedAt: null } }),
      prisma.raffle.count({ where: { status: { in: ["SCHEDULED", "ACTIVE"] }, cancelledAt: null } }),
      prisma.raffleEntry.count(),
      prisma.user.count({ where: { deletedAt: null } }),
    ]);
    return res.json({ success: true, stats: { submittedProjects, approvedProjects, activeRaffles, entries, users } });
  } catch (error) { next(error); }
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
      select: { id: true, name: true, slug: true, description: true, logoUrl: true, websiteUrl: true, xUrl: true, discordUrl: true, category: true, status: true, rejectionReason: true, createdAt: true },
    });
    return res.json({ success: true, projects });
  } catch (error) { next(error); }
});

router.patch("/projects/:id", async (req, res, next) => {
  try {
    const parsed = z.object({ status: z.enum(["APPROVED", "REJECTED", "ARCHIVED"]), rejectionReason: z.string().trim().max(1000).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid moderation data" });
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project || project.deletedAt) return res.status(404).json({ success: false, message: "Project not found" });
    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        status: parsed.data.status,
        approvedAt: parsed.data.status === "APPROVED" ? new Date() : null,
        approvedByUserId: parsed.data.status === "APPROVED" ? req.userId : null,
        rejectedAt: parsed.data.status === "REJECTED" ? new Date() : null,
        rejectionReason: parsed.data.status === "REJECTED" ? (parsed.data.rejectionReason || "Rejected by moderator") : null,
      },
    });
    return res.json({ success: true, project: updated });
  } catch (error) { next(error); }
});

router.get("/raffles", async (_req, res, next) => {
  try {
    const raffles = await prisma.raffle.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        project: { select: { name: true, logoUrl: true } },
        createdBy: { select: { email: true, username: true } },
        _count: { select: { entries: true, winners: true, tasks: true } },
      },
    });
    return res.json({ success: true, raffles });
  } catch (error) { next(error); }
});

export default router;
