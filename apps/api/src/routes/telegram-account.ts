import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const telegramAuthSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  first_name: z.string().min(1).max(255),
  last_name: z.string().max(255).optional(),
  username: z.string().max(255).optional(),
  photo_url: z.string().url().max(1000).optional(),
  auth_date: z.number().int().positive(),
  hash: z.string().regex(/^[a-f0-9]{64}$/i),
});

type TelegramAuth = z.infer<typeof telegramAuthSchema>;

function getTelegramUserId(id: TelegramAuth["id"]): string {
  return typeof id === "number" ? String(id) : id;
}

function verifyTelegramAuth(data: TelegramAuth): boolean {
  if (!env.TELEGRAM_BOT_TOKEN) return false;

  const authAge = Math.floor(Date.now() / 1000) - data.auth_date;
  if (authAge < -60 || authAge > 24 * 60 * 60) return false;

  const checkData: Record<string, string> = {
    auth_date: String(data.auth_date),
    first_name: data.first_name,
    id: getTelegramUserId(data.id),
  };

  if (data.last_name) checkData.last_name = data.last_name;
  if (data.username) checkData.username = data.username;
  if (data.photo_url) checkData.photo_url = data.photo_url;

  const dataCheckString = Object.keys(checkData)
    .sort()
    .map((key) => `${key}=${checkData[key]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(env.TELEGRAM_BOT_TOKEN).digest();
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedHash, "hex"),
    Buffer.from(data.hash, "hex"),
  );
}

function serializeAccount(account: {
  id: string;
  telegram_user_id: bigint;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  connected_at: Date;
}) {
  return {
    id: account.id,
    telegramUserId: String(account.telegram_user_id),
    username: account.username,
    firstName: account.first_name,
    lastName: account.last_name,
    connectedAt: account.connected_at,
  };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });

    const rows = await prisma.$queryRaw<Array<{
      id: string;
      telegram_user_id: bigint;
      username: string | null;
      first_name: string | null;
      last_name: string | null;
      connected_at: Date;
    }>>`
      SELECT id, telegram_user_id, username, first_name, last_name, connected_at
      FROM telegram_accounts
      WHERE user_id = ${req.userId}::uuid
      LIMIT 1
    `;

    return res.json({
      success: true,
      connected: rows.length > 0,
      account: rows[0] ? serializeAccount(rows[0]) : null,
      botUsername: env.TELEGRAM_BOT_USERNAME || null,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/connect", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_BOT_USERNAME) {
      return res.status(503).json({ success: false, message: "Telegram connection is not configured on the server." });
    }

    const parsed = telegramAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid Telegram authorization data." });
    }

    if (!verifyTelegramAuth(parsed.data)) {
      return res.status(401).json({ success: false, message: "Telegram authorization could not be verified." });
    }

    const telegramUserId = getTelegramUserId(parsed.data.id);

    const existing = await prisma.$queryRaw<Array<{ user_id: string }>>`
      SELECT user_id
      FROM telegram_accounts
      WHERE telegram_user_id = ${telegramUserId}::bigint
      LIMIT 1
    `;

    if (existing[0] && existing[0].user_id !== req.userId) {
      return res.status(409).json({ success: false, message: "This Telegram account is already connected to another account." });
    }

    await prisma.$executeRaw`
      INSERT INTO telegram_accounts (
        user_id, telegram_user_id, username, first_name, last_name, connected_at, updated_at
      ) VALUES (
        ${req.userId}::uuid,
        ${telegramUserId}::bigint,
        ${parsed.data.username ?? null},
        ${parsed.data.first_name},
        ${parsed.data.last_name ?? null},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id) DO UPDATE SET
        telegram_user_id = EXCLUDED.telegram_user_id,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        updated_at = CURRENT_TIMESTAMP
    `;

    const rows = await prisma.$queryRaw<Array<{
      id: string;
      telegram_user_id: bigint;
      username: string | null;
      first_name: string | null;
      last_name: string | null;
      connected_at: Date;
    }>>`
      SELECT id, telegram_user_id, username, first_name, last_name, connected_at
      FROM telegram_accounts
      WHERE user_id = ${req.userId}::uuid
      LIMIT 1
    `;

    return res.json({ success: true, connected: true, account: rows[0] ? serializeAccount(rows[0]) : null });
  } catch (error) {
    next(error);
  }
});

router.delete("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });

    await prisma.$executeRaw`
      DELETE FROM telegram_accounts
      WHERE user_id = ${req.userId}::uuid
    `;

    return res.json({ success: true, connected: false });
  } catch (error) {
    next(error);
  }
});

export default router;
