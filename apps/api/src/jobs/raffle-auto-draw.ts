import { prisma } from "../lib/prisma.js";
import { evaluateRaffleEntry } from "../services/eligibility.service.js";
import { drawRaffle } from "../services/raffle-draw.service.js";

const DRAW_DELAY_MS = 5 * 60 * 1000;
let running = false;

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

        await drawRaffle(raffle.id, raffle.createdByUserId);
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
