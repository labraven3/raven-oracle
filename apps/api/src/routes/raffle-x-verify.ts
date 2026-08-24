import crypto from "node:crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { verifyRaffleTask } from "../services/raffle-task-verification.service.js";
import { verifyXTask } from "../services/raffle-x-task-verification.service.js";

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
  const account = await prisma.socialAccount.findFirst({
    where: { userId, provider: "X", isActive: true },
  });
  if (!account) return { ok: false, reason: "Connect your X account first" };
  if (!account.refreshTokenEncrypted) return { ok: true };
  if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET) return { ok: false, reason: "X OAuth is not configured correctly" };

  let refreshToken: string;
  try {
    refreshToken = decrypt(account.refreshTokenEncrypted);
  } catch {
    return { ok: false, reason: "Unable to decrypt your X refresh token. Reconnect X from Profile." };
  }

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    client_id: env.X_CLIENT_ID,
  });
  const credentials = Buffer.from(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body,
  });
  const data = await response.json().catch(() => ({})) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    return {
      ok: false,
      reason: data.error_description || data.error || `X token refresh failed (${response.status})`,
    };
  }

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

  return { ok: true };
}

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
      select: { id: true, raffleId: true, type: true, targetUrl: true },
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

    // Cost-control policy: only Follow touches the X API.
    // Like/Repost are trust-based completion after the user returns from the target.
    if (task.type === "X_FOLLOW") {
      const refreshed = await refreshXSession(req.userId);
      if (!refreshed.ok) {
        return res.status(400).json({
          success: false,
          taskId,
          entryId: entry.id,
          verified: false,
          reason: refreshed.reason,
        });
      }
      const result = await verifyXTask(taskId, entry.id, req.userId);
      return res.json({ success: true, taskId, entryId: entry.id, ...result });
    }

    if (task.type === "X_LIKE" || task.type === "X_REPOST") {
      const verificationData = {
        status: "VERIFIED" as const,
        verifiedAt: new Date(),
        failureReason: null,
        evidence: {
          verificationMode: "RETURN_CLICK",
          targetUrl: task.targetUrl,
          userConfirmedReturn: true,
        },
      };
      await prisma.raffleTaskVerification.upsert({
        where: { raffleTaskId_entryId: { raffleTaskId: task.id, entryId: entry.id } },
        create: { raffleTaskId: task.id, entryId: entry.id, userId: req.userId, ...verificationData },
        update: verificationData,
      });
      return res.json({
        success: true,
        taskId: task.id,
        entryId: entry.id,
        verified: true,
        reason: null,
        evidence: verificationData.evidence,
      });
    }

    const result = await verifyRaffleTask(taskId, entry.id, req.userId);
    return res.json({ success: true, taskId, entryId: entry.id, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
