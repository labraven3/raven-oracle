import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const taskSchema = z.object({
  type: z.enum(["X_FOLLOW", "X_LIKE", "X_REPOST", "DISCORD_JOIN"]),
  title: z.string().trim().max(255).default(""),
  description: z.string().trim().max(1000).default(""),
  target: z.string().trim().max(500).default(""),
  targetUrl: z.string().url().optional().or(z.literal("")).default(""),
  isRequired: z.boolean().default(true),
});

const draftSchema = z.object({
  title: z.string().trim().max(200).default(""),
  description: z.string().trim().max(5000).default(""),
  prizeName: z.string().trim().max(200).default(""),
  prizeDescription: z.string().trim().max(5000).default(""),
  prizeQuantity: z.number().int().positive().default(1),
  winnerCount: z.number().int().positive().default(1),
  maxEntriesPerUser: z.number().int().positive().default(1),
  fairnessAlgorithmVersion: z.string().trim().max(100).default("v1"),
  raffleType: z.enum(["RAFFLE", "FCFS"]).default("RAFFLE"),
  startsAt: z.string().optional().default(""),
  endsAt: z.string().optional().default(""),
  tasks: z.array(taskSchema).default([]),
});

function normalizeTask(task: z.infer<typeof taskSchema>) {
  const type = task.type;
  if (type === "X_FOLLOW") {
    const username = task.target.trim().replace(/^@/, "");
    return { ...task, title: "Follow on X", description: "", target: username, targetUrl: username ? `https://x.com/${username}` : "" };
  }
  if (type === "X_LIKE") return { ...task, title: "Like on X", description: "", target: task.targetUrl || task.target, targetUrl: task.targetUrl || task.target };
  if (type === "X_REPOST") return { ...task, title: "Repost on X", description: "", target: task.targetUrl || task.target, targetUrl: task.targetUrl || task.target };
  return { ...task, title: "Join Discord", description: "", target: task.targetUrl || task.target, targetUrl: task.targetUrl || task.target };
}

function taskTargetIssue(task: ReturnType<typeof normalizeTask>) {
  const url = task.targetUrl.trim();
  if (!url) return "A real task URL is required";
  if (task.type === "X_FOLLOW" && !/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/?(?:\?.*)?$/i.test(url)) return "X Follow must use an X profile URL, e.g. https://x.com/project";
  if ((task.type === "X_LIKE" || task.type === "X_REPOST") && !/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[^/]+\/status\/\d+(?:\?.*)?$/i.test(url)) return "X Like/Repost must use an X post URL";
  if (task.type === "DISCORD_JOIN" && !/^https?:\/\/(?:www\.)?discord(?:\.gg\/|\.com\/invite\/)[A-Za-z0-9-]+(?:\?.*)?$/i.test(url)) return "Discord Join must use a Discord invite URL";
  return null;
}

function validatePublishedTasks(tasks: Array<z.infer<typeof taskSchema>>) {
  for (const [index, rawTask] of tasks.entries()) {
    const task = normalizeTask(rawTask);
    if (!task.target.trim()) return `Task ${index + 1} needs its target`;
    const issue = taskTargetIssue(task);
    if (issue) return `Task ${index + 1}: ${issue}`;
  }
  return null;
}

function getId(req: import("express").Request, res: import("express").Response) {
  const value = req.params.projectId;
  if (typeof value !== "string" || !value) { res.status(400).json({ success: false, message: "Invalid project ID" }); return null; }
  return value;
}

async function ownedProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, status: true, deletedAt: true, submittedByUserId: true } });
  if (!project || project.deletedAt) return { error: [404, "Project not found"] as const };
  if (project.submittedByUserId !== userId) return { error: [403, "You do not own this project"] as const };
  return { project };
}

function draftData(raffle: { entryRules: unknown }) {
  const rules = raffle.entryRules && typeof raffle.entryRules === "object" ? raffle.entryRules as Record<string, unknown> : {};
  return (rules.draft as Record<string, unknown> | undefined) ?? {};
}

router.use(requireAuth);

router.get("/:projectId", async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const projectId = getId(req, res); if (!projectId) return;
    const owner = await ownedProject(projectId, req.userId); if (owner.error) return res.status(owner.error[0]).json({ success: false, message: owner.error[1] });
    const drafts = await prisma.raffle.findMany({ where: { projectId, createdByUserId: req.userId, status: "DRAFT", cancelledAt: null }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, title: true, prizeName: true, updatedAt: true, createdAt: true, entryRules: true, winnerCount: true, prizeQuantity: true } });
    return res.json({ success: true, drafts: drafts.map((draft) => ({ id: draft.id, title: draft.title === "Untitled Draft" ? "" : draft.title, prizeName: draft.prizeName === "TBD" ? "" : draft.prizeName, updatedAt: draft.updatedAt, createdAt: draft.createdAt, winnerCount: draft.winnerCount, prizeQuantity: draft.prizeQuantity, ...draftData(draft) })) });
  } catch (error) { next(error); }
});

router.post("/:projectId", async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const projectId = getId(req, res); if (!projectId) return;
    const owner = await ownedProject(projectId, req.userId); if (owner.error) return res.status(owner.error[0]).json({ success: false, message: owner.error[1] });
    const parsed = draftSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid draft data", errors: parsed.error.issues });
    const draft = parsed.data;
    const placeholderStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const placeholderEnd = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const created = await prisma.raffle.create({ data: { projectId, createdByUserId: req.userId, title: draft.title || "Untitled Draft", description: draft.description || null, prizeName: draft.prizeName || "TBD", prizeDescription: null, prizeQuantity: draft.winnerCount, startsAt: draft.startsAt ? new Date(draft.startsAt) : placeholderStart, endsAt: draft.endsAt ? new Date(draft.endsAt) : placeholderEnd, entryRules: { draft }, status: "DRAFT", maxEntriesPerUser: 1, winnerCount: draft.winnerCount, fairnessAlgorithmVersion: null }, select: { id: true } });
    return res.status(201).json({ success: true, draftId: created.id });
  } catch (error) { next(error); }
});

router.put("/:projectId/:draftId", async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const projectId = getId(req, res); if (!projectId) return;
    const owner = await ownedProject(projectId, req.userId); if (owner.error) return res.status(owner.error[0]).json({ success: false, message: owner.error[1] });
    const parsed = draftSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid draft data", errors: parsed.error.issues });
    const existing = await prisma.raffle.findFirst({ where: { id: req.params.draftId, projectId, createdByUserId: req.userId, status: "DRAFT", cancelledAt: null } });
    if (!existing) return res.status(404).json({ success: false, message: "Draft not found" });
    const draft = parsed.data; const start = draft.startsAt ? new Date(draft.startsAt) : existing.startsAt; const end = draft.endsAt ? new Date(draft.endsAt) : existing.endsAt;
    await prisma.raffle.update({ where: { id: existing.id }, data: { title: draft.title || "Untitled Draft", description: draft.description || null, prizeName: draft.prizeName || "TBD", prizeDescription: null, prizeQuantity: draft.winnerCount, startsAt: start, endsAt: end, maxEntriesPerUser: 1, winnerCount: draft.winnerCount, fairnessAlgorithmVersion: null, entryRules: { draft } } });
    return res.json({ success: true, draftId: existing.id });
  } catch (error) { next(error); }
});

router.delete("/:projectId/:draftId", async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const projectId = getId(req, res); if (!projectId) return;
    const owner = await ownedProject(projectId, req.userId); if (owner.error) return res.status(owner.error[0]).json({ message: owner.error[1] });
    const existing = await prisma.raffle.findFirst({ where: { id: req.params.draftId, projectId, createdByUserId: req.userId, status: "DRAFT", cancelledAt: null }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Draft not found" });
    await prisma.raffle.update({ where: { id: existing.id }, data: { status: "CANCELLED", cancelledAt: new Date(), entryRules: { draftDeleted: true } } });
    return res.json({ success: true });
  } catch (error) { next(error); }
});

router.post("/:projectId/:draftId/publish", async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const projectId = getId(req, res); if (!projectId) return;
    const owner = await ownedProject(projectId, req.userId); if (owner.error) return res.status(owner.error[0]).json({ success: false, message: owner.error[1] });
    const existing = await prisma.raffle.findFirst({ where: { id: req.params.draftId, projectId, createdByUserId: req.userId, status: "DRAFT", cancelledAt: null } });
    if (!existing) return res.status(404).json({ success: false, message: "Draft not found" });
    const draft = draftData(existing); const parsed = draftSchema.safeParse(draft);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid draft data", errors: parsed.error.issues });
    const data = parsed.data;
    if (!data.title.trim() || !data.prizeName.trim()) return res.status(400).json({ success: false, message: "Raffle name and prize are required before publishing" });
    if (!data.startsAt || !data.endsAt) return res.status(400).json({ success: false, message: "Start and end time are required before publishing" });
    const taskIssue = validatePublishedTasks(data.tasks);
    if (taskIssue) return res.status(400).json({ success: false, message: taskIssue });
    const startsAt = new Date(data.startsAt); const endsAt = new Date(data.endsAt); const now = new Date();
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt || endsAt <= now) return res.status(400).json({ success: false, message: "Invalid raffle dates" });
    if (data.winnerCount > data.prizeQuantity) return res.status(400).json({ success: false, message: "Winner count cannot exceed WL spots" });
    const normalizedTasks = data.tasks.map(normalizeTask);
    const raffle = await prisma.$transaction(async (tx) => {
      const updated = await tx.raffle.update({ where: { id: existing.id }, data: { title: data.title, description: data.description || null, prizeName: data.prizeName, prizeDescription: null, prizeQuantity: data.winnerCount, startsAt, endsAt, status: startsAt > now ? "SCHEDULED" : "ACTIVE", maxEntriesPerUser: 1, winnerCount: data.winnerCount, fairnessAlgorithmVersion: null, entryRules: { raffleType: data.raffleType, tasks: normalizedTasks, walletRequired: true, socialRequired: true } } });
      if (normalizedTasks.length) await tx.raffleTask.createMany({ data: normalizedTasks.map((task, index) => ({ raffleId: updated.id, type: task.type, title: task.title, description: null, target: task.target, targetUrl: task.targetUrl || null, isRequired: task.isRequired, sortOrder: index })) });
      return updated;
    });
    return res.json({ success: true, raffleId: raffle.id });
  } catch (error) { next(error); }
});

export default router;
