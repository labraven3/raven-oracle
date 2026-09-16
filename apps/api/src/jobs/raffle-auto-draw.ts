import { prisma } from "../lib/prisma.js";
import { evaluateRaffleEntry } from "../services/eligibility.service.js";
import { drawRaffle } from "../services/raffle-draw.service.js";
import { announceDiscordWinners, type DiscordPromotionConfig } from "../services/discord-publisher.service.js";
import { env } from "../config/env.js";

const DRAW_DELAY_MS = 5 * 60 * 1000;
let running = false;

function promotionFromRules(entryRules: unknown): DiscordPromotionConfig {
  if (!entryRules || typeof entryRules !== "object" || Array.isArray(entryRules)) return {};
  const promotion = (entryRules as Record<string, unknown>).discordPromotion;
  return promotion && typeof promotion === "object" && !Array.isArray(promotion) ? promotion as DiscordPromotionConfig : {};
}

async function announceWinnersOnDiscord(raffleId: string, draw: Awaited<ReturnType<typeof drawRaffle>>) {
  if (!env.DISCORD_BOT_TOKEN) return;
  const rules = draw.raffle.entryRules;
  const promotion = promotionFromRules(rules);
  if (!promotion.enabled || !promotion.channelId || !promotion.messageId || promotion.winnerAnnouncedAt) return;

  const accounts = await prisma.socialAccount.findMany({
    where: { userId: { in: draw.winners.map((winner) => winner.userId) }, provider: "DISCORD", isActive: true },
    select: { userId: true, providerAccountId: true, providerUsername: true },
  });
  const byUser = new Map(accounts.map((account) => [account.userId, account]));
  const announcement = await announceDiscordWinners({
    channelId: promotion.channelId,
    title: draw.raffle.title,
    raffleUrl: `${env.WEB_ORIGIN}/raffles/${raffleId}`,
    winners: draw.winners.map((winner) => {
      const account = byUser.get(winner.userId);
      return { username: account?.providerUsername ?? null, discordAccountId: account?.providerAccountId ?? null };
    }),
  });

  const currentRules = rules && typeof rules === "object" && !Array.isArray(rules) ? rules as Record<string, unknown> : {};
  await prisma.raffle.update({
    where: { id: raffleId },
    data: { entryRules: { ...currentRules, discordPromotion: { ...promotion, winnerAnnouncementMessageId: announcement.messageId, winnerAnnouncedAt: announcement.announcedAt } } },
  });
}

/**
 * Automatically closes and draws raffles five minutes after endsAt.
 * Existing manual draw remains available; this only handles raffles that
 * are still ACTIVE after their entry window has ended.
 */
export async function processAutomaticRaffleDraws() {
  if (running) return;
  running = true;

  try {
    const cutoff = new Date(Date.now() - DRAW_DELAY_MS);
    const raffles = await prisma.raffle.findMany({
      where: {
        status: "ACTIVE",
        endsAt: { lte: cutoff },
      },
      select: {
        id: true,
        createdByUserId: true,
        endsAt: true,
      },
      orderBy: { endsAt: "asc" },
      take: 25,
    });

    for (const raffle of raffles) {
      try {
        // Close exactly once. Another worker/manual action winning this race
        // means this iteration simply skips the raffle.
        const closed = await prisma.raffle.updateMany({
          where: { id: raffle.id, status: "ACTIVE", endsAt: { lte: cutoff } },
          data: { status: "CLOSED" },
        });
        if (closed.count !== 1) continue;

        // The existing draw service requires all entries to be evaluated first.
        // Do that here so the automatic path has the same eligibility semantics
        // as the existing manual flow.
        const pending = await prisma.raffleEntry.findMany({
          where: { raffleId: raffle.id, status: "PENDING" },
          select: { id: true },
        });
        for (const entry of pending) {
          try {
            await evaluateRaffleEntry(entry.id);
          } catch (error) {
            console.error(`[auto-draw] entry evaluation failed for ${entry.id}:`, error instanceof Error ? error.message : error);
          }
        }

        const draw = await drawRaffle(raffle.id, raffle.createdByUserId);
        try {
          await announceWinnersOnDiscord(raffle.id, draw);
        } catch (error) {
          // Discord is an optional notification channel; a Discord outage must
          // never roll back or invalidate a completed raffle draw.
          console.error(`[auto-draw] Discord winner announcement failed for ${raffle.id}:`, error instanceof Error ? error.message : error);
        }
        console.log(`[auto-draw] completed raffle ${raffle.id}`);
      } catch (error) {
        // Leave a failed raffle CLOSED so the normal manual controls remain
        // available and the automatic worker can retry safely on the next tick
        // without ever drawing the same raffle twice.
        console.error(`[auto-draw] failed for raffle ${raffle.id}:`, error instanceof Error ? error.message : error);
      }
    }
  } finally {
    running = false;
  }
}

export function startAutomaticRaffleDrawWorker() {
  void processAutomaticRaffleDraws();
  const timer = setInterval(() => void processAutomaticRaffleDraws(), 60_000);
  timer.unref?.();
  return timer;
}
