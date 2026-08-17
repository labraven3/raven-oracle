import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const createSchema = z.object({
  title: z.string().trim().min(4).max(160),
  description: z.string().trim().min(20).max(5000),
  evidenceLinks: z.array(z.string().url()).min(1).max(10),
  opportunityType: z.enum(["MINT", "AIRDROP", "WL", "TRADING", "TOOL", "SECURITY", "OTHER"]),
  expectedResult: z.string().trim().max(1000).optional(),
  projectId: z.string().uuid().optional(),
});

router.get("/leaderboard", async (_req, res, next) => {
  try {
    const rows = await prisma.user.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true, username: true, displayName: true, avatarUrl: true, pointTransactions: { select: { amount: true } } },
      take: 200,
    });
    const leaderboard = rows.map((u) => ({
      userId: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      points: u.pointTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    })).filter((u) => u.points !== 0).sort((a, b) => b.points - a.points).slice(0, 100);
    return res.json({ success: true, leaderboard });
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "VERIFIED";
    const allowed = ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "REJECTED", "DUPLICATE", "ARCHIVED"];
    const where = allowed.includes(status) ? { status: status as never, deletedAt: null } : { deletedAt: null };
    const submissions = await prisma.alphaSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { submittedBy: { select: { username: true, displayName: true, avatarUrl: true } }, project: { select: { id: true, name: true, logoUrl: true } } },
    });
    return res.json({ success: true, submissions });
  } catch (error) { next(error); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid alpha submission", errors: z.treeifyError(parsed.error) });
    if (parsed.data.projectId) {
      const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId }, select: { id: true, status: true } });
      if (!project || project.status !== "APPROVED") return res.status(400).json({ success: false, message: "Project is not available" });
    }
    const submission = await prisma.alphaSubmission.create({ data: { submittedByUserId: req.userId, projectId: parsed.data.projectId ?? null, title: parsed.data.title, description: parsed.data.description, evidenceLinks: parsed.data.evidenceLinks, opportunityType: parsed.data.opportunityType, expectedResult: parsed.data.expectedResult ?? null } });
    return res.status(201).json({ success: true, submission });
  } catch (error) { next(error); }
});

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const submissions = await prisma.alphaSubmission.findMany({ where: { submittedByUserId: req.userId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100 });
    return res.json({ success: true, submissions });
  } catch (error) { next(error); }
});

export default router;
