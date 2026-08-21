import { prisma } from "../lib/prisma.js";

const PERMANENT_WINNER_STATUSES = ["SELECTED", "NOTIFIED", "DISQUALIFIED"] as const;

type WinnerIntegrityStatus = (typeof PERMANENT_WINNER_STATUSES)[number];

export async function auditWinnerIntegrity(raffleId: string) {
  const winners = await prisma.raffleWinner.findMany({
    where: { raffleId },
    orderBy: { selectionRank: "asc" },
    select: {
      id: true,
      selectionRank: true,
      status: true,
      entryId: true,
      notifiedAt: true,
      notificationStatus: true,
      walletAddressSnapshot: true,
    },
  });

  const issues: string[] = [];
  const ranks = new Set<number>();
  const entries = new Set<string>();

  for (const winner of winners) {
    if (ranks.has(winner.selectionRank)) {
      issues.push(`Duplicate winner selection rank: ${winner.selectionRank}.`);
    }
    ranks.add(winner.selectionRank);

    if (entries.has(winner.entryId)) {
      issues.push(`Duplicate winner entry: ${winner.entryId}.`);
    }
    entries.add(winner.entryId);

    if (!(PERMANENT_WINNER_STATUSES as readonly string[]).includes(winner.status)) {
      issues.push(`Unexpected legacy winner status detected: ${winner.status}.`);
    }

    if (winner.status === "NOTIFIED" && winner.notificationStatus !== "SENT") {
      issues.push(`Winner ${winner.id} is NOTIFIED without SENT notification status.`);
    }
  }

  return {
    healthy: issues.length === 0,
    issues,
    winners: winners.map((winner) => ({
      id: winner.id,
      selectionRank: winner.selectionRank,
      status: winner.status as WinnerIntegrityStatus,
      notifiedAt: winner.notifiedAt,
      notificationStatus: winner.notificationStatus,
      walletAddressSnapshot: winner.walletAddressSnapshot,
    })),
  };
}
