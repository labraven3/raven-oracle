import { Router } from "express";
import xlsx from "node-xlsx";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { notifyWinner } from "../services/raffle-winner.service.js";

const router = Router();
function getId(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function getCreatorRaffle(raffleId: string, userId: string) { return prisma.raffle.findFirst({ where: { id: raffleId, createdByUserId: userId }, select: { id: true, createdByUserId: true, status: true, title: true, winnerCount: true, prizeName: true, endsAt: true } }); }

router.get("/:raffleId/winners", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, createdByUserId: true, status: true, title: true, winnerCount: true, prizeName: true, endsAt: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    const isCreator = raffle.createdByUserId === req.userId;
    const winners = await prisma.raffleWinner.findMany({
      where: isCreator ? { raffleId } : { raffleId, userId: req.userId },
      orderBy: { selectionRank: "asc" },
      select: { id: true, entryId: true, userId: true, walletAddressSnapshot: true, selectionRank: true, status: true, notificationStatus: true, selectedAt: true, notifiedAt: true, user: { select: { displayName: true, username: true, socialAccounts: { where: { isActive: true, provider: { in: ["X", "DISCORD"] } }, select: { provider: true, providerUsername: true, displayName: true } } } } },
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
    if (!raffle) return res.status(403).json({ success: false, message: "Only the raffle creator can resend winner notifications" });
    const winner = await prisma.raffleWinner.findFirst({ where: { id: winnerId, raffleId }, select: { id: true } });
    if (!winner) return res.status(404).json({ success: false, message: "Winner not found" });
    const updated = await notifyWinner(raffleId, winnerId);
    return res.json({ success: true, winner: updated, message: "Winner notification sent again." });
  } catch (error) { next(error); }
});

router.get("/:raffleId/winners/export", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const raffle = await getCreatorRaffle(raffleId, req.userId);
    if (!raffle) return res.status(403).json({ success: false, message: "Only the raffle creator can export winners" });
    if (raffle.status !== "COMPLETED") return res.status(409).json({ success: false, code: "RAFFLE_NOT_COMPLETED", message: "Complete the winner draw before exporting winners." });

    const winners = await prisma.raffleWinner.findMany({
      where: { raffleId },
      orderBy: { selectionRank: "asc" },
      select: {
        selectionRank: true,
        walletAddressSnapshot: true,
        user: { select: { socialAccounts: { where: { provider: { in: ["X", "DISCORD"] }, isActive: true }, select: { provider: true, providerUsername: true, displayName: true } } } },
      },
    });
    if (winners.length === 0) return res.status(400).json({ success: false, message: "No winners have been selected yet." });

    const rows: string[][] = [
      ["X", "Discord", "Wallet Address"],
      ...winners.map((winner) => {
        const x = winner.user.socialAccounts.find((account) => account.provider === "X");
        const discord = winner.user.socialAccounts.find((account) => account.provider === "DISCORD");
        return [x?.providerUsername ?? x?.displayName ?? "", discord?.providerUsername ?? discord?.displayName ?? "", winner.walletAddressSnapshot ?? ""];
      }),
    ];

    const workbook = xlsx.build([
      { name: "Winners", data: rows, options: { "!cols": [{ wch: 28 }, { wch: 28 }, { wch: 52 }] } },
    ]);
    const safeTitle = raffle.title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "raffle";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="raven-oracle-${safeTitle}-winners.xlsx"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(workbook);
  } catch (error) { next(error); }
});

export default router;
