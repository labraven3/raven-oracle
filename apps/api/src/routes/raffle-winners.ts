import { Router } from "express";
import xlsx from "node-xlsx";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { notifyWinner } from "../services/raffle-winner.service.js";
import { createWinnerGoogleSheetForUser } from "../services/google-oauth-sheets.service.js";
import { getGoogleConnectionStatus } from "../services/google-oauth.service.js";

const router = Router();
function getId(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function formatDate(value: Date | null | undefined) { return value ? value.toISOString() : ""; }
async function getCreatorRaffle(raffleId: string, userId: string) { return prisma.raffle.findFirst({ where: { id: raffleId, createdByUserId: userId }, select: { id: true, createdByUserId: true, status: true, title: true, winnerCount: true, prizeName: true, endsAt: true } }); }

async function getWinnerRows(raffleId: string) {
  const winners = await prisma.raffleWinner.findMany({
    where: { raffleId }, orderBy: { selectionRank: "asc" },
    select: {
      selectionRank: true, walletAddressSnapshot: true, status: true, notificationStatus: true, selectedAt: true, notifiedAt: true,
      raffle: { select: { title: true, endsAt: true } },
      entry: { select: { id: true, status: true, enteredAt: true, taskVerifications: { select: { status: true, verifiedAt: true, failureReason: true, raffleTask: { select: { title: true, type: true, isRequired: true, sortOrder: true } } } } } },
      user: { select: { email: true, emailVerifiedAt: true, displayName: true, username: true, socialAccounts: { where: { isActive: true, provider: { in: ["X", "DISCORD"] } }, select: { provider: true, providerUsername: true, displayName: true } } } },
    },
  });
  return winners.map((winner) => {
    const x = winner.user.socialAccounts.find((account) => account.provider === "X");
    const discord = winner.user.socialAccounts.find((account) => account.provider === "DISCORD");
    return {
      rank: winner.selectionRank, raffleTitle: winner.raffle.title, raffleEndsAt: winner.raffle.endsAt, entryId: winner.entry.id, entryStatus: winner.entry.status, enteredAt: winner.entry.enteredAt,
      xUsername: x?.providerUsername ?? x?.displayName ?? "", discordUsername: discord?.providerUsername ?? discord?.displayName ?? "", walletAddress: winner.walletAddressSnapshot,
      email: winner.user.email ?? "", emailVerified: Boolean(winner.user.emailVerifiedAt), winnerStatus: winner.status, notificationStatus: winner.notificationStatus, selectedAt: winner.selectedAt, notifiedAt: winner.notifiedAt,
      tasks: winner.entry.taskVerifications.slice().sort((a, b) => a.raffleTask.sortOrder - b.raffleTask.sortOrder).map((task) => ({ title: task.raffleTask.title, type: task.raffleTask.type, required: task.raffleTask.isRequired, status: task.status, verifiedAt: task.verifiedAt, failureReason: task.failureReason })),
    };
  });
}

router.get("/:raffleId/winners", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, createdByUserId: true, status: true, title: true, winnerCount: true, prizeName: true, endsAt: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    const isCreator = raffle.createdByUserId === req.userId;
    const winners = await prisma.raffleWinner.findMany({ where: isCreator ? { raffleId } : { raffleId, userId: req.userId }, orderBy: { selectionRank: "asc" }, select: { id: true, entryId: true, userId: true, walletAddressSnapshot: true, selectionRank: true, status: true, notificationStatus: true, selectedAt: true, notifiedAt: true, user: { select: { displayName: true, username: true, email: true, emailVerifiedAt: true, socialAccounts: { where: { isActive: true, provider: { in: ["X", "DISCORD"] } }, select: { provider: true, providerUsername: true, displayName: true } } } } } });
    return res.json({ success: true, raffle, winners, viewer: isCreator ? "CREATOR" : "WINNER" });
  } catch (error) { next(error); }
});

router.post("/:raffleId/winners/:winnerId/notify", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId); const winnerId = getId(req.params.winnerId);
    if (!raffleId || !winnerId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle, winner, or authentication" });
    const raffle = await getCreatorRaffle(raffleId, req.userId); if (!raffle) return res.status(403).json({ success: false, message: "Only the raffle creator can send winner notifications" });
    const winner = await notifyWinner(raffleId, winnerId); return res.json({ success: true, winner });
  } catch (error) { next(error); }
});

router.post("/:raffleId/winners/:winnerId/resend", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId); const winnerId = getId(req.params.winnerId);
    if (!raffleId || !winnerId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle, winner, or authentication" });
    const raffle = await getCreatorRaffle(raffleId, req.userId); if (!raffle) return res.status(403).json({ success: false, message: "Only the raffle creator can resend winner emails" });
    const winner = await prisma.raffleWinner.findFirst({ where: { id: winnerId, raffleId }, select: { id: true } }); if (!winner) return res.status(404).json({ success: false, message: "Winner not found" });
    const updated = await notifyWinner(raffleId, winnerId); return res.json({ success: true, winner: updated, message: "Winner email sent again." });
  } catch (error) { next(error); }
});

router.get("/:raffleId/winners/export", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const raffle = await getCreatorRaffle(raffleId, req.userId);
    if (!raffle) return res.status(403).json({ success: false, message: "Only the raffle creator can export winners" });
    if (raffle.status !== "COMPLETED") return res.status(409).json({ success: false, code: "RAFFLE_NOT_COMPLETED", message: "Finish the winner draw before exporting winners." });
    const winners = await getWinnerRows(raffleId);
    if (winners.length === 0) return res.status(400).json({ success: false, message: "No winners have been selected yet." });

    const winnerSheet = [
      ["Rank", "Raffle", "X Username", "Discord Username", "Wallet Address", "Email", "Email Verified", "Winner Status", "Notification Status", "Entry Status", "Entered At", "Selected At", "Notified At"],
      ...winners.map((winner) => [winner.rank, winner.raffleTitle, winner.xUsername, winner.discordUsername, winner.walletAddress, winner.email, winner.emailVerified ? "Yes" : "No", winner.winnerStatus, winner.notificationStatus, winner.entryStatus, formatDate(winner.enteredAt), formatDate(winner.selectedAt), formatDate(winner.notifiedAt)]),
    ];
    const taskSheet = [
      ["Rank", "X Username", "Discord Username", "Wallet Address", "Task", "Task Type", "Required", "Verification Status", "Verified At", "Failure Reason"],
      ...winners.flatMap((winner) => winner.tasks.map((task) => [winner.rank, winner.xUsername, winner.discordUsername, winner.walletAddress, task.title, task.type, task.required ? "Yes" : "No", task.status, formatDate(task.verifiedAt), task.failureReason ?? ""])),
    ];
    const buffer = xlsx.build([
      { name: "Winners", data: winnerSheet },
      { name: "Task Verification", data: taskSheet },
    ], { sheetOptions: { "!cols": [{ wch: 8 }, { wch: 28 }, { wch: 22 }, { wch: 24 }, { wch: 46 }, { wch: 34 }, { wch: 15 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 26 }, { wch: 26 }, { wch: 26 }] } });

    const safeTitle = raffle.title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "raffle";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="raven-oracle-${safeTitle}-winners.xlsx"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(buffer);
  } catch (error) { next(error); }
});

// Kept for existing accounts/integrations. The creator UI no longer requires Google access for winner export.
router.get("/:raffleId/winners/export/google-sheets/status", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId); if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const raffle = await getCreatorRaffle(raffleId, req.userId); if (!raffle) return res.status(403).json({ success: false, message: "Only the raffle creator can view export settings" });
    return res.json({ success: true, ...(await getGoogleConnectionStatus(req.userId)) });
  } catch (error) { next(error); }
});
router.post("/:raffleId/winners/export/google-sheets", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getId(req.params.raffleId); if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const raffle = await getCreatorRaffle(raffleId, req.userId); if (!raffle) return res.status(403).json({ success: false, message: "Only the raffle creator can export winners" });
    if (raffle.endsAt.getTime() > Date.now()) return res.status(409).json({ success: false, code: "RAFFLE_NOT_ENDED", message: "Winner export becomes available after the raffle ends." });
    const winners = await getWinnerRows(raffleId); if (winners.length === 0) return res.status(400).json({ success: false, message: "No winners have been selected yet" });
    const google = await getGoogleConnectionStatus(req.userId); if (!google.connected) return res.status(409).json({ success: false, code: "GOOGLE_NOT_CONNECTED", message: "Google export is not connected for this account." });
    const result = await createWinnerGoogleSheetForUser(req.userId, { raffleTitle: raffle.title, raffleEndsAt: raffle.endsAt, rows: winners });
    return res.json({ success: true, ...result, message: result.repeatedExport ? "Winner export created as a new worksheet." : "Winner Google Sheet created." });
  } catch (error) { next(error); }
});

export default router;
