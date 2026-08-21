import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAdminAuth);

router.get("/:raffleId", async (req, res, next) => {
  try {
    const raffleId = req.params.raffleId;
    const raffle = await prisma.raffle.findUnique({
      where: { id: raffleId },
      include: {
        tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        entries: { select: { id: true, status: true, captchaPassed: true, socialVerifiedAtEntry: true, eligibilityCheckedAt: true } },
        winners: { select: { id: true, status: true, notificationStatus: true, selectionRank: true, entryId: true } },
      },
    });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });

    const issues: string[] = [];
    const warnings: string[] = [];
    const now = new Date();

    if (!raffle.projectId) warnings.push("Raffle has no linked project.");
    if (raffle.endsAt <= raffle.startsAt) issues.push("End time is not after start time.");
    if (raffle.winnerCount > raffle.prizeQuantity) issues.push("Winner count exceeds prize quantity.");
    if (raffle.tasks.length === 0) issues.push("Raffle has no tasks configured.");
    if (raffle.tasks.filter((task) => task.isRequired).length === 0) warnings.push("Raffle has no required tasks.");

    if (raffle.status === "SCHEDULED" && raffle.startsAt <= now) warnings.push("Scheduled raffle start time has already arrived.");
    if (raffle.status === "ACTIVE" && raffle.endsAt <= now) warnings.push("Active raffle has passed its end time.");
    if (raffle.status === "CLOSED" && raffle.endsAt > now) issues.push("Closed raffle has not reached its configured end time.");
    if (raffle.status === "COMPLETED" && raffle.winners.length === 0 && raffle.winnerCount > 0) issues.push("Completed raffle has no winners.");

    const eligible = raffle.entries.filter((entry) => entry.status === "ELIGIBLE");
    const ineligible = raffle.entries.filter((entry) => entry.status === "INELIGIBLE");
    const pending = raffle.entries.filter((entry) => entry.status === "PENDING");

    if (["CLOSED", "DRAWING", "COMPLETED"].includes(raffle.status) && pending.length > 0) {
      warnings.push(`${pending.length} entries are still pending eligibility.`);
    }

    const winnerRanks = new Set<number>();
    const winnerEntries = new Set<string>();
    for (const winner of raffle.winners) {
      if (winnerRanks.has(winner.selectionRank)) issues.push(`Duplicate winner selection rank: ${winner.selectionRank}.`);
      winnerRanks.add(winner.selectionRank);
      if (winnerEntries.has(winner.entryId)) issues.push(`Duplicate winner entry: ${winner.entryId}.`);
      winnerEntries.add(winner.entryId);
      if (!eligible.some((entry) => entry.id === winner.entryId)) warnings.push(`Winner ${winner.id} was not marked ELIGIBLE at audit time.`);
    }

    if (raffle.winners.length > raffle.winnerCount) issues.push("Winner records exceed configured winner count.");

    const rules = raffle.entryRules && typeof raffle.entryRules === "object" && !Array.isArray(raffle.entryRules)
      ? raffle.entryRules as Record<string, unknown>
      : {};
    if (rules.captchaRequired === true) {
      const missingCaptcha = raffle.entries.filter((entry) => entry.captchaPassed !== true && entry.status === "ELIGIBLE");
      if (missingCaptcha.length) issues.push(`${missingCaptcha.length} eligible entries have not passed CAPTCHA.`);
    }

    return res.json({
      success: true,
      audit: {
        raffleId: raffle.id,
        status: raffle.status,
        healthy: issues.length === 0,
        issues,
        warnings,
        counts: {
          tasks: raffle.tasks.length,
          requiredTasks: raffle.tasks.filter((task) => task.isRequired).length,
          entries: raffle.entries.length,
          eligible: eligible.length,
          ineligible: ineligible.length,
          pending: pending.length,
          winners: raffle.winners.length,
          winnerSlots: raffle.winnerCount,
        },
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
