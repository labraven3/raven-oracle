import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../middleware/auth.js";

const router = Router();

const taskSchema = z.object({
  type: z.enum(["X_FOLLOW", "X_LIKE", "X_REPOST", "DISCORD_JOIN"]),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional().nullable(),
  target: z.string().trim().min(1).max(500),
  targetUrl: z.string().url().optional().nullable().or(z.literal("")),
  isRequired: z.boolean().default(true),
});

const createSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  prizeName: z.string().trim().min(1).max(200),
  prizeDescription: z.string().trim().max(5000).optional(),
  prizeQuantity: z.number().int().positive().default(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  winnerCount: z.number().int().positive().default(1),
  maxEntriesPerUser: z.number().int().positive().default(1),
  fairnessAlgorithmVersion: z.string().trim().max(100).default("v1"),
  tasks: z.array(taskSchema).min(1),
});

router.post("/raffles", requireAdminAuth, async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid raffle data",
        errors: z.treeifyError(parsed.error),
      });
    }

    const data = parsed.data;
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);
    const now = new Date();

    if (endsAt <= startsAt) {
      return res.status(400).json({ success: false, message: "endsAt must be after startsAt" });
    }
    if (endsAt <= now) {
      return res.status(400).json({ success: false, message: "Raffle end time must be in the future" });
    }
    if (data.winnerCount > data.prizeQuantity) {
      return res.status(400).json({ success: false, message: "winnerCount cannot exceed prizeQuantity" });
    }

    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { id: true, name: true, category: true, status: true, deletedAt: true },
    });

    if (!project || project.deletedAt) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }
    if (project.status !== "APPROVED") {
      return res.status(400).json({ success: false, message: "Only approved projects can have raffles" });
    }
    if (project.category !== "NFT") {
      return res.status(400).json({ success: false, message: "Raffles are currently limited to NFT projects" });
    }

    const raffle = await prisma.$transaction(async (tx) => {
      const created = await tx.raffle.create({
        data: {
          projectId: data.projectId,
          createdByUserId: req.userId!,
          title: data.title,
          description: data.description || null,
          prizeName: data.prizeName,
          prizeDescription: data.prizeDescription || null,
          prizeQuantity: data.prizeQuantity,
          startsAt,
          endsAt,
          entryRules: {
            tasks: data.tasks.map((task) => ({
              type: task.type,
              title: task.title,
              target: task.target,
              targetUrl: task.targetUrl || null,
              isRequired: task.isRequired,
            })),
          },
          status: startsAt > now ? "SCHEDULED" : "ACTIVE",
          maxEntriesPerUser: data.maxEntriesPerUser,
          winnerCount: data.winnerCount,
          fairnessAlgorithmVersion: data.fairnessAlgorithmVersion,
        },
      });

      await tx.raffleTask.createMany({
        data: data.tasks.map((task, index) => ({
          raffleId: created.id,
          type: task.type,
          title: task.title,
          description: task.description || null,
          target: task.target,
          targetUrl: task.targetUrl || null,
          isRequired: task.isRequired,
          sortOrder: index,
        })),
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.userId!,
          action: "RAFFLE_CREATED",
          entityType: "Raffle",
          entityId: created.id,
          summary: `Raffle created: ${created.title}`,
          after: {
            projectId: created.projectId,
            status: created.status,
            winnerCount: created.winnerCount,
            prizeQuantity: created.prizeQuantity,
          },
        },
      });

      return tx.raffle.findUnique({
        where: { id: created.id },
        include: {
          project: { select: { id: true, name: true, logoUrl: true } },
          tasks: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    return res.status(201).json({ success: true, raffle });
  } catch (error) {
    next(error);
  }
});

export default router;
