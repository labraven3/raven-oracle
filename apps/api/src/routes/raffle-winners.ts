import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { notifyWinner } from "../services/raffle-winner.service.js";
import { createWinnerGoogleSheetForUser } from "../services/google-oauth-sheets.service.js";
import { getGoogleConnectionStatus } from "../services/google-oauth.service.js";

const router = Router();

function getId(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function csv(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

async function getCreatorRaffle(raffleId: string, userId: string) {
  return prisma.raffle.findFirst({ where: { id: raffleId, createdByUserId: userId }, select: { id: true, createdByUserId: true, status: true, title: true, winnerCount: true, prizeName: true } });
}

async function getWinnerRows(raffleId: string) {
  const winners = await prisma.raffleWinner.findMany({
    where: { raffleId },
    orderBy: { selectionRank: "asc" },
    select: {
      selectionRank: true,
      walletAddressSnapshot: true,
      status: true,
      notificationStatus: true,
      selectedAt: true,
      notifiedAt: true,
      user: {
        select: {
          email: true,
          emailVerifiedAt: true,
          displayName: true,
          username: true,
          socialAccounts: {
            where: { isActive: true, provider: { in: ["X", "DISCORD"] } },
            select: { provider: true, providerUsername: true, displayName: true },
          },
        },
      },
    },
  });

  return winners.map((winner) => {
    const x = winner.user.socialAccounts.find((account) => account.provider === "X");
    const discord = winner.user.socialAccounts.find((account) => account.provider === "DISCORD");
    return {
      rank: winner.selectionRank,
      xUsername: x?.providerUsername ?? x?.displayName ?? "",
      discordUsername: discord?.providerUsername ?? discord?.displayName ?? "",
      walletAddress: winner.walletAddressSnapshot,
      email: winner.user.email ?? "",
      emailVerified: Boolean(winner.user.emailVerifiedAt),
      winnerStatus: winner.status,
      notificationStatus: winner.notificationStatus,
      selectedAt: winner.selectedAt,
      notifiedAt: winner.notifiedAt,
    };
  });
}

router.get("/:raffleId/winners", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, createdByUserId: true, status: true, title: true, winnerCount: true, prizeName: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    const isCreator = raffle.createdByUserId === req.userId;
    const winners = await prisma.raffleWinner.findMany({
      where: isCreator ? { raffleId } : { raffleId, userId: req.userId },
      orderBy: { selectionRank: "asc" },
      select: {
        id: true, entryId: true, userId: true, walletAddressSnapshot: true, selectionRank: true,
        status: true, notificationStatus: true, selectedAt: true, notifiedAt: true,
        user: {
          select: {
            displayName: true, username: true, email: true, emailVerifiedAt: true,
            socialAccounts: {
              where: { isActive: true, provider: { in: ["X", "DISCORD"] } },
              select: { provider: true, providerUsername: true, displayName: true },
            },
          },
        },
      },
    });
    return res.json({ success: true, raffle, winners, viewer: isCreator ? "CREATOR" : "WINNER" });
  } catch (error) { next(error); }
});

router.post("/:raffleId/winners/:winnerId/notify", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId); const winnerId = getId(req.params.winnerId);
    if (!raffleId || !winnerId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle, winner, or authentication" });
    const raffle = await getCreatorRaffle(raffleId, req.userId);
    if (!raffle) return res.status(403).json({ success: false, message: "Only the raffle creator can send winner notifications" });
    const winner = await notifyWinner(raffleId, winnerId);
    return res.json({ success: true, winner });
  } catch (error) { next(error); }
});

router.post("/:raffleId/winners/:winnerId/resend", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId); const winnerId = getId(req.params.winnerId);
    if (!raffleId || !winnerId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle, winner, or authentication" });
    const raffle = await getCreatorRaffle(raffleId, req.userId);
    if (!raffle) return res.status(403).json({ success: false, message: "Only the raffle creator can resend winner emails" });
    const winner = await prisma.raffleWinner.findFirst({ where: { id: winnerId, raffleId }, select: { id: true, status: true } });
    if (!winner) return res.status(404).json({ success: false, message: "Winner not found" });
    const updated = await notifyWinner(raffleId, winnerId);
    return res.json({ success: true, winner: updated, message: "Winner email sent again." });
  } catch (error) { next(error); }
});

router.get("/:raffleId/winners/export", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const raffle = await getCreatorRaffle(raffleId, req.userId);
    if (!raffle) return res.status(403).json({ success: false, message: "Only the raffle creator can export the whitelist" });
    const winners = await getWinnerRows(raffleId);
    const lines = [
      ["rank", "x_username", "discord_username", "wallet_address", "email", "email_verified", "winner_status", "notification_status", "selected_at", "notified_at"].map(csv).join(","),
      ...winners.map((winner) => [winner.rank, winner.xUsername, winner.discordUsername, winner.walletAddress, winner.email, winner.emailVerified ? "yes" : "no", winner.winnerStatus, winner.notificationStatus, winner.selectedAt.toISOString(), winner.notifiedAt?.toISOString() ?? ""].map(csv).join(",")),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="raven-oracle-${raffle.id}-winners.csv"`);
    return res.send(`\uFEFF${lines.join("\n")}`);
  } catch (error) { next(error); }
});

router.get("/:raffleId/winners/export/google-sheets/status", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const raffle = await getCreatorRaffle(raffleId, req.userId);
    if (!raffle) return res.status(403).json({ success: false, message: "Only the raffle creator can view export settings" });
    return res.json({ success: true, ...(await getGoogleConnectionStatus(req.userId)) });
  } catch (error) { next(error); }
});

router.post("/:raffleId/winners/export/google-sheets", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const raffle = await getCreatorRaffle(raffleId, req.userId);
    if (!raffle) return res.status(403).json({ success: false, message: "Only the raffle creator can export winners" });
    const winners = await getWinnerRows(raffleId);
    if (winners.length === 0) return res.status(400).json({ success: false, message: "No winners have been selected yet" });

    const google = await getGoogleConnectionStatus(req.userId);
    if (!google.connected) return res.status(409).json({ success: false, code: "GOOGLE_NOT_CONNECTED", message: "Connect your Google Drive account before exporting winners." });

    const result = await createWinnerGoogleSheetForUser(req.userId, { raffleTitle: raffle.title, rows: winners });
    return res.json({ success: true, ...result, message: "Winner Google Sheet created in your Google Drive." });
  } catch (error) { next(error); }
});

export default router;
