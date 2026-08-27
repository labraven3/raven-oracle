import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { verifyRaffleTask } from "../services/raffle-task-verification.service.js";

const router = Router();

const taskType = z.enum(["X_FOLLOW", "X_LIKE", "X_REPOST", "DISCORD_JOIN"]);
const createTaskSchema = z.object({ type: taskType, title: z.string().min(1).max(255), description: z.string().max(1000).nullable().optional(), target: z.string().min(1).max(500), targetUrl: z.string().url().nullable().optional(), isRequired: z.boolean().default(true), sortOrder: z.number().int().min(0).default(0) });
function getId(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function assertDraft(raffle: { status: string }) {
  if (raffle.status !== "DRAFT") {
    const error = new Error("Raffle tasks can only be changed while the raffle is in draft status");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }
}

router.get("/:raffleId/tasks", async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId);
    if (!raffleId) return res.status(400).json({ success: false, message: "Invalid raffle ID" });
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    const tasks = await prisma.raffleTask.findMany({ where: { raffleId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, type: true, title: true, description: true, target: true, targetUrl: true, isRequired: true, sortOrder: true } });
    res.setHeader("Cache-Control", "public, max-age=20, stale-while-revalidate=60");
    return res.json({ success: true, tasks });
  } catch (error) { next(error); }
});

router.post("/:raffleId/tasks", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId); if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const parsed = createTaskSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid raffle task", errors: z.treeifyError(parsed.error) });
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, createdByUserId: true, status: true } }); if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" }); if (raffle.createdByUserId !== req.userId) return res.status(403).json({ success: false, message: "Only the raffle creator can add tasks" });
    assertDraft(raffle);
    const task = await prisma.raffleTask.create({ data: { raffleId, type: parsed.data.type, title: parsed.data.title, description: parsed.data.description ?? null, target: parsed.data.target, targetUrl: parsed.data.targetUrl ?? null, isRequired: parsed.data.isRequired, sortOrder: parsed.data.sortOrder } });
    return res.status(201).json({ success: true, task });
  } catch (error) { next(error); }
});

router.patch("/:raffleId/tasks/:taskId", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId); const taskId = getId(req.params.taskId); if (!raffleId || !taskId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle, task, or authentication" });
    const parsed = createTaskSchema.partial().safeParse(req.body); if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid raffle task", errors: z.treeifyError(parsed.error) });
    const task = await prisma.raffleTask.findUnique({ where: { id: taskId }, include: { raffle: { select: { createdByUserId: true, status: true } } } }); if (!task || task.raffleId !== raffleId) return res.status(404).json({ success: false, message: "Raffle task not found" }); if (task.raffle.createdByUserId !== req.userId) return res.status(403).json({ success: false, message: "Only the raffle creator can update tasks" });
    assertDraft(task.raffle);
    const data = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined)); const updated = await prisma.raffleTask.update({ where: { id: taskId }, data }); return res.json({ success: true, task: updated });
  } catch (error) { next(error); }
});

router.delete("/:raffleId/tasks/:taskId", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId); const taskId = getId(req.params.taskId); if (!raffleId || !taskId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle, task, or authentication" });
    const task = await prisma.raffleTask.findUnique({ where: { id: taskId }, include: { raffle: { select: { createdByUserId: true, status: true } } } }); if (!task || task.raffleId !== raffleId) return res.status(404).json({ success: false, message: "Raffle task not found" }); if (task.raffle.createdByUserId !== req.userId) return res.status(403).json({ success: false, message: "Only the raffle creator can delete tasks" });
    assertDraft(task.raffle);
    await prisma.raffleTask.delete({ where: { id: taskId } }); return res.json({ success: true, message: "Raffle task deleted" });
  } catch (error) { next(error); }
});

router.post("/:raffleId/tasks/:taskId/verify", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId); const taskId = getId(req.params.taskId); if (!raffleId || !taskId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle, task, or authentication" });
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, status: true, startsAt: true, endsAt: true } }); if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    const now = new Date(); if (raffle.status !== "ACTIVE") return res.status(400).json({ success: false, message: raffle.status === "SCHEDULED" ? "Raffle has not started yet" : "Raffle is not accepting verification" }); if (now < raffle.startsAt) return res.status(400).json({ success: false, message: "Raffle has not started yet" }); if (now > raffle.endsAt) return res.status(400).json({ success: false, message: "Raffle has ended" });
    const task = await prisma.raffleTask.findUnique({ where: { id: taskId } }); if (!task || task.raffleId !== raffleId) return res.status(404).json({ success: false, message: "Raffle task not found" });
    const entry = await prisma.raffleEntry.findUnique({ where: { raffleId_userId: { raffleId, userId: req.userId } } }); if (!entry) return res.status(404).json({ success: false, message: "You must create a raffle entry first" });
    const result = await verifyRaffleTask(taskId, entry.id, req.userId); return res.json({ success: true, taskId, entryId: entry.id, ...result });
  } catch (error) { next(error); }
});

export default router;
