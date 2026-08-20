import crypto from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS telegram_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL UNIQUE,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

let tableReady: Promise<void> | null = null;

export async function ensureTelegramTable() {
  if (!tableReady) {
    tableReady = prisma.$executeRawUnsafe(TABLE_SQL).then(() => undefined).catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  await tableReady;
}

function signature(userId: string, timestamp: string) {
  return crypto.createHmac("sha256", env.JWT_SECRET).update(`${userId}:${timestamp}`).digest("base64url").slice(0, 11);
}

export function createTelegramStartToken(userId: string) {
  const timestamp = Date.now().toString();
  return `${userId}.${timestamp}.${signature(userId, timestamp)}`;
}

export function verifyTelegramStartToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Telegram connection token");
  const [userId, timestamp, providedSignature] = parts;
  if (!userId || !timestamp || !providedSignature || !/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Invalid Telegram connection token");
  const createdAt = Number(timestamp);
  if (!Number.isSafeInteger(createdAt) || Date.now() - createdAt > 10 * 60 * 1000 || createdAt > Date.now() + 60_000) throw new Error("Telegram connection token expired");
  const expected = signature(userId, timestamp);
  const a = Buffer.from(providedSignature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("Invalid Telegram connection token");
  return userId;
}

export async function getTelegramAccount(userId: string) {
  await ensureTelegramTable();
  const rows = await prisma.$queryRaw<Array<{ telegram_user_id: bigint; username: string | null; first_name: string | null; last_name: string | null; connected_at: Date }>>`
    SELECT telegram_user_id, username, first_name, last_name, connected_at
    FROM telegram_accounts
    WHERE user_id = ${userId}::uuid
    LIMIT 1
  `;
  const account = rows[0];
  if (!account) return null;
  return {
    telegramUserId: account.telegram_user_id.toString(),
    username: account.username,
    firstName: account.first_name,
    lastName: account.last_name,
    connectedAt: account.connected_at,
  };
}

export async function connectTelegramAccount(input: { userId: string; telegramUserId: number; username?: string | null; firstName?: string | null; lastName?: string | null }) {
  await ensureTelegramTable();
  const telegramUserId = BigInt(input.telegramUserId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRaw<Array<{ user_id: string }>>`
      SELECT user_id::text AS user_id FROM telegram_accounts
      WHERE telegram_user_id = ${telegramUserId}
      LIMIT 1
    `;
    if (existing[0] && existing[0].user_id !== input.userId) {
      throw new Error("This Telegram account is already connected to another Raven Oracle account");
    }

    await tx.$executeRaw`DELETE FROM telegram_accounts WHERE user_id = ${input.userId}::uuid`;
    await tx.$executeRaw`
      INSERT INTO telegram_accounts (user_id, telegram_user_id, username, first_name, last_name)
      VALUES (${input.userId}::uuid, ${telegramUserId}, ${input.username ?? null}, ${input.firstName ?? null}, ${input.lastName ?? null})
      ON CONFLICT (telegram_user_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        updated_at = NOW()
    `;
  });
}

export async function disconnectTelegramAccount(userId: string) {
  await ensureTelegramTable();
  await prisma.$executeRaw`DELETE FROM telegram_accounts WHERE user_id = ${userId}::uuid`;
}

export async function sendTelegramMessage(chatId: number, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!response.ok) throw new Error(`Telegram sendMessage failed (${response.status})`);
}

export function telegramBotLink(token: string) {
  if (!env.TELEGRAM_BOT_USERNAME) throw new Error("Telegram bot is not configured");
  return `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(token)}`;
}
