import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function getId(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * GET /api/raffles/:raffleId/winners
 * Creator can see all winners; a selected winner can see their own record.
 */
router.get("/:raffleId/winners", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId);
    if (!raffleId || !req.userId) {
      return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    }

    const raffle = await prisma.raffle.findUnique({
      where: { id: raffleId },
      select: { id: true, createdByUserId: true, status: true, title: true, winnerCount: true },
    });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });

    const isCreator = raffle.createdByUserId === req.userId;
    const winners = await prisma.raffleWinner.findMany({
      where: isCreator ? { raffleId } : { raffleId, userId: req.userId },
      orderBy: { selectionRank: "asc" },
      select: {
        id: true,
        entryId: true,
        userId: true,
        walletAddressSnapshot: true,
        selectionRank: true,
        status: true,
        notificationStatus: true,
        selectedAt: true,
        notifiedAt: true,
        claimedAt: true,
        claimReference: true,
        replacedByWinnerId: true,
        replacementReason: true,
      },
    });

    return res.json({
      success: true,
      raffle,
      winners,
      viewer: isCreator ? "CREATOR" : "WINNER",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
