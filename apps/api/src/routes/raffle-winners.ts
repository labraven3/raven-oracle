import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function getId(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function csv(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

async function getRaffleForViewer(raffleId: string, userId: string) {
  const raffle = await prisma.raffle.findUnique({
    where: { id: raffleId },
    select: { id: true, createdByUserId: true, status: true, title: true, winnerCount: true, prizeName: true },
  });
  if (!raffle) return null;
  const isCreator = raffle.createdByUserId === userId;
  if (!isCreator) return null;
  return raffle;
}

/**
 * GET /api/raffles/:raffleId/winners
 * Creator sees the complete whitelist-ready winner list.
 * A participant sees only their own winner record.
 */
router.get("/:raffleId/winners", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });

    const raffle = await prisma.raffle.findUnique({
      where: { id: raffleId },
      select: { id: true, createdByUserId: true, status: true, title: true, winnerCount: true, prizeName: true },
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
        user: { select: { displayName: true, username: true, email: true, emailVerifiedAt: true } },
      },
    });

    return res.json({ success: true, raffle, winners, viewer: isCreator ? "CREATOR" : "WINNER" });
  } catch (error) { next(error); }
});

/** Creator-only CSV export for sending wallet addresses to an NFT project for whitelist setup. */
router.get("/:raffleId/winners/export", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const raffle = await getRaffleForViewer(raffleId, req.userId);
    if (!raffle) return res.status(403).json({ success: false, message: "Only the raffle creator can export the whitelist" });

    const winners = await prisma.raffleWinner.findMany({
      where: { raffleId }, orderBy: { selectionRank: "asc" },
      select: { selectionRank: true, walletAddressSnapshot: true, status: true, notificationStatus: true, selectedAt: true, notifiedAt: true, user: { select: { email: true, emailVerifiedAt: true, displayName: true, username: true } } },
    });

    const lines = [
      ["rank", "wallet_address", "winner_status", "email", "email_verified", "notification_status", "selected_at", "notified_at"].map(csv).join(","),
      ...winners.map((winner) => [winner.selectionRank, winner.walletAddressSnapshot, winner.status, winner.user.email ?? "", winner.user.emailVerifiedAt ? "yes" : "no", winner.notificationStatus, winner.selectedAt.toISOString(), winner.notifiedAt?.toISOString() ?? ""].map(csv).join(",")),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="raven-oracle-${raffle.id}-winners.csv"`);
    return res.send(`\uFEFF${lines.join("\n")}`);
  } catch (error) { next(error); }
});

export default router;
