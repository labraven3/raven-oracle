import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { verifyRaffleTask } from "../services/raffle-task-verification.service.js";

const router = Router();

router.post("/:raffleId/tasks/:taskId/verify", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });

    const raffleId = req.params.raffleId;
    const taskId = req.params.taskId;
    if (typeof raffleId !== "string" || typeof taskId !== "string") {
      return res.status(400).json({ success: false, message: "Invalid raffle or task ID" });
    }

    const raffle = await prisma.raffle.findUnique({
      where: { id: raffleId },
      select: { id: true, status: true, startsAt: true, endsAt: true },
    });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });

    const now = new Date();
    if (raffle.status === "SCHEDULED" && now < raffle.startsAt) {
      return res.status(400).json({ success: false, message: "Raffle has not started yet" });
    }
    if (["CANCELLED", "COMPLETED"].includes(raffle.status)) {
      return res.status(400).json({ success: false, message: "Raffle is no longer accepting verification" });
    }
    if (now < raffle.startsAt) {
      return res.status(400).json({ success: false, message: "Raffle has not started yet" });
    }

    const task = await prisma.raffleTask.findUnique({
      where: { id: taskId },
      select: { id: true, raffleId: true },
    });
    if (!task || task.raffleId !== raffleId) {
      return res.status(404).json({ success: false, message: "Raffle task not found" });
    }

    const entry = await prisma.raffleEntry.findUnique({
      where: { raffleId_userId: { raffleId, userId: req.userId } },
      select: { id: true, userId: true, createdAt: true },
    });
    if (!entry) {
      return res.status(404).json({ success: false, message: "Start the raffle entry before verifying this task" });
    }

    if (now > raffle.endsAt && entry.createdAt > raffle.endsAt) {
      return res.status(400).json({ success: false, message: "This entry was started after the raffle ended" });
    }

    // Temporary trust-based mode for ALL social tasks.
    // No X, Discord, OAuth token refresh, or external verification API is used.
    const result = await verifyRaffleTask(taskId, entry.id, req.userId);
    return res.json({ success: true, taskId, entryId: entry.id, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
