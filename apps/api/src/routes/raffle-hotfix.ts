import crypto from "node:crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { drawRaffle } from "../services/raffle-draw.service.js";
import { notifyWinner } from "../services/raffle-winner.service.js";
import { verifyRaffleTask } from "../services/raffle-task-verification.service.js";

const router = Router();

function encryptionKey() {
  return crypto.createHash("sha256").update(env.JWT_SECRET).digest();
}

function encrypt(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decrypt(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid encrypted token");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
}

async function refreshXSession(userId: string) {
  const account = await prisma.socialAccount.findFirst({ where: { userId, provider: "X", isActive: true } });
  if (!account?.refreshTokenEncrypted) return false;

  const refreshToken = decrypt(account.refreshTokenEncrypted);
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    client_id: env.X_CLIENT_ID!,
  });
  const credentials = Buffer.from(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${credentials}` },
    body,
  });
  const data = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || `X token refresh failed (${response.status})`);

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      accessTokenEncrypted: encrypt(data.access_token),
      ...(data.refresh_token ? { refreshTokenEncrypted: encrypt(data.refresh_token) } : {}),
      tokenExpiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      isActive: true,
      disconnectedAt: null,
    },
  });
  return true;
}

async function ensureXSessionFresh(userId: string) {
  const account = await prisma.socialAccount.findFirst({ where: { userId, provider: "X", isActive: true }, select: { tokenExpiresAt: true, refreshTokenEncrypted: true } });
  if (!account?.refreshTokenEncrypted || !account.tokenExpiresAt) return;
  if (account.tokenExpiresAt.getTime() > Date.now() + 5 * 60 * 1000) return;
  await refreshXSession(userId);
}

async function closeExpired(raffleId: string) {
  const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, status: true, endsAt: true } });
  if (!raffle) return null;
  if (["SCHEDULED", "ACTIVE"].includes(raffle.status) && new Date() >= raffle.endsAt) {
    return prisma.raffle.update({ where: { id: raffleId }, data: { status: "CLOSED" }, select: { id: true, status: true, endsAt: true } });
  }
  return raffle;
}

router.post("/:raffleId/tasks/:taskId/verify", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const { raffleId, taskId } = req.params;
    if (typeof raffleId !== "string" || typeof taskId !== "string") return res.status(400).json({ success: false, message: "Invalid raffle or task ID" });

    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, status: true, startsAt: true, endsAt: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    const now = new Date();
    if (raffle.status !== "ACTIVE") return res.status(400).json({ success: false, message: raffle.status === "SCHEDULED" ? "Raffle has not started yet" : "Raffle is not accepting verification" });
    if (now < raffle.startsAt) return res.status(400).json({ success: false, message: "Raffle has not started yet" });
    if (now > raffle.endsAt) return res.status(400).json({ success: false, message: "Raffle has ended" });

    const task = await prisma.raffleTask.findUnique({ where: { id: taskId }, select: { id: true, raffleId: true, type: true } });
    if (!task || task.raffleId !== raffleId) return res.status(404).json({ success: false, message: "Raffle task not found" });
    const entry = await prisma.raffleEntry.findUnique({ where: { raffleId_userId: { raffleId, userId: req.userId } } });
    if (!entry) return res.status(404).json({ success: false, message: "You must create a raffle entry first" });

    if (["X_FOLLOW", "X_LIKE", "X_REPOST"].includes(task.type)) {
      try { await ensureXSessionFresh(req.userId); } catch (error) {
        return res.status(400).json({ success: false, taskId, entryId: entry.id, verified: false, reason: error instanceof Error ? error.message : "Unable to refresh X session" });
      }
    }

    const result = await verifyRaffleTask(taskId, entry.id, req.userId);
    return res.json({ success: true, taskId, entryId: entry.id, ...result });
  } catch (error) { next(error); }
});

router.delete("/:raffleId", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const raffleId = req.params.raffleId;
    if (typeof raffleId !== "string") return res.status(400).json({ success: false, message: "Invalid raffle ID" });
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, createdByUserId: true, status: true, cancelledAt: true, _count: { select: { winners: true } } } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    if (raffle.createdByUserId !== req.userId) return res.status(403).json({ success: false, message: "Only the raffle creator can delete this raffle" });
    if (raffle._count.winners > 0 || raffle.status === "COMPLETED") return res.status(400).json({ success: false, message: "Completed raffles with winners are retained for winner/export audit." });
    if (raffle.cancelledAt || raffle.status === "CANCELLED") return res.status(400).json({ success: false, message: "Raffle is already deleted" });
    const deleted = await prisma.raffle.update({ where: { id: raffleId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    return res.json({ success: true, message: "Raffle deleted", raffle: deleted });
  } catch (error) { next(error); }
});

router.post("/:raffleId/draw", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const raffleId = req.params.raffleId;
    if (typeof raffleId !== "string") return res.status(400).json({ success: false, message: "Invalid raffle ID" });

    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { createdByUserId: true, status: true, endsAt: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    if (raffle.createdByUserId !== req.userId) return res.status(403).json({ success: false, message: "Only the raffle creator can draw this raffle" });

    if (["SCHEDULED", "ACTIVE"].includes(raffle.status) && new Date() >= raffle.endsAt) {
      await prisma.raffle.update({ where: { id: raffleId }, data: { status: "CLOSED" } });
    }
    const closed = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { status: true, endsAt: true } });
    if (!closed || closed.status !== "CLOSED") return res.status(400).json({ success: false, message: "Raffle is not ready to draw" });
    if (new Date() < closed.endsAt) return res.status(400).json({ success: false, message: "Raffle cannot be drawn before its end time" });

    const result = await drawRaffle(raffleId, req.userId);
    const notificationResults = await Promise.allSettled(result.winners.map((winner) => notifyWinner(raffleId, winner.id)));
    return res.json({ success: true, ...result, notifications: notificationResults.map((item, index) => ({ winnerId: result.winners[index]?.id, sent: item.status === "fulfilled", error: item.status === "rejected" ? (item.reason instanceof Error ? item.reason.message : "Notification failed") : null })) });
  } catch (error) {
    // This route is mounted before the general raffle router, so normalize
    // draw errors here instead of letting expected lifecycle errors become 500s.
    const message = error instanceof Error ? error.message : "Unable to draw raffle";
    const known = [
      "Raffle has already been drawn",
      "Cancelled raffle cannot be drawn",
      "Raffle must be closed before drawing winners",
      "Raffle end time has not been reached",
      "Raffle draw is already in progress or is no longer drawable",
      "No eligible entries with payout wallets available",
    ];
    if (known.includes(message) || /^Raffle has \\d+ unevaluated entr/.test(message)) {
      return res.status(message === "Raffle has already been drawn" ? 409 : 400).json({ success: false, message });
    }
    return next(error);
  }
});

router.get("/:raffleId/winners", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const raffleId = req.params.raffleId;
    if (typeof raffleId !== "string") return res.status(400).json({ success: false, message: "Invalid raffle ID" });
    await closeExpired(raffleId);
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, createdByUserId: true, status: true, title: true, winnerCount: true, prizeName: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    const isCreator = raffle.createdByUserId === req.userId;
    const winners = await prisma.raffleWinner.findMany({ where: isCreator ? { raffleId } : { raffleId, userId: req.userId }, orderBy: { selectionRank: "asc" }, select: { id: true, entryId: true, userId: true, walletAddressSnapshot: true, selectionRank: true, status: true, notificationStatus: true, selectedAt: true, notifiedAt: true, user: { select: { displayName: true, username: true, email: true, emailVerifiedAt: true } } } });
    return res.json({ success: true, raffle, winners, viewer: isCreator ? "CREATOR" : "WINNER" });
  } catch (error) { next(error); }
});

router.delete("/:projectId", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const projectId = req.params.projectId;
    if (typeof projectId !== "string") return res.status(400).json({ success: false, message: "Invalid project ID" });
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, category: true, deletedAt: true, submittedByUserId: true } });
    if (!project || project.deletedAt) return res.status(404).json({ success: false, message: "Project not found" });
    if (project.submittedByUserId !== req.userId) return res.status(403).json({ success: false, message: "You do not own this project" });
    if (project.category !== "NFT") return res.status(400).json({ success: false, message: "Only NFT projects can be deleted from creator dashboard" });
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.raffle.updateMany({ where: { projectId, status: { in: ["DRAFT", "SCHEDULED", "ACTIVE", "CLOSED"] }, cancelledAt: null }, data: { status: "CANCELLED", cancelledAt: now } });
      await tx.project.update({ where: { id: projectId }, data: { deletedAt: now, status: "ARCHIVED" } });
    });
    return res.json({ success: true, message: "NFT project deleted", projectId });
  } catch (error) { next(error); }
});

export default router;
