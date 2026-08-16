import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";

const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function notifyWinner(raffleId: string, winnerId: string) {
  return prisma.$transaction(async (tx) => {
    const winner = await tx.raffleWinner.findFirst({ where: { id: winnerId, raffleId } });
    if (!winner) throw new Error("Winner not found");
    if (!["SELECTED", "NOTIFIED"].includes(winner.status)) {
      throw new Error(`Winner cannot be notified from status ${winner.status}`);
    }

    return tx.raffleWinner.update({
      where: { id: winner.id },
      data: {
        status: "NOTIFIED",
        notifiedAt: winner.notifiedAt ?? new Date(),
        notificationStatus: "SENT",
      },
    });
  });
}

export async function claimWinner(raffleId: string, winnerId: string, requestingUserId: string) {
  return prisma.$transaction(async (tx) => {
    const winner = await tx.raffleWinner.findFirst({
      where: { id: winnerId, raffleId, userId: requestingUserId },
    });
    if (!winner) throw new Error("Winner not found");
    if (winner.status === "CLAIMED") return winner;
    if (winner.status === "EXPIRED" || winner.status === "REPLACED") {
      throw new Error(`Winner is ${winner.status.toLowerCase()}`);
    }
    if (winner.status !== "NOTIFIED") {
      throw new Error("Winner must be notified before claiming");
    }

    const deadlineSource = winner.notifiedAt ?? winner.selectedAt;
    const deadline = new Date(deadlineSource.getTime() + CLAIM_WINDOW_MS);
    if (new Date() > deadline) {
      await tx.raffleWinner.update({ where: { id: winner.id }, data: { status: "EXPIRED" } });
      throw new Error("Winner claim window has expired");
    }

    const claimReference = `RAVEN-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
    return tx.raffleWinner.update({
      where: { id: winner.id },
      data: { status: "CLAIMED", claimedAt: new Date(), claimReference },
    });
  });
}

export async function expireAndReplaceWinner(raffleId: string, winnerId: string) {
  return prisma.$transaction(async (tx) => {
    const winner = await tx.raffleWinner.findFirst({ where: { id: winnerId, raffleId } });
    if (!winner) throw new Error("Winner not found");
    if (winner.status === "CLAIMED") throw new Error("Claimed winner cannot be expired");
    if (winner.status === "EXPIRED" || winner.status === "REPLACED") {
      throw new Error(`Winner is already ${winner.status.toLowerCase()}`);
    }

    const deadlineSource = winner.notifiedAt ?? winner.selectedAt;
    const deadline = new Date(deadlineSource.getTime() + CLAIM_WINDOW_MS);
    if (new Date() <= deadline) throw new Error("Winner claim window has not expired");

    const previousWinnerEntries = await tx.raffleWinner.findMany({
      where: { raffleId },
      select: { entryId: true },
    });
    const excludedEntryIds = previousWinnerEntries.map((item) => item.entryId);

    const replacementEntry = await tx.raffleEntry.findFirst({
      where: {
        raffleId,
        status: "NOT_SELECTED",
        id: { notIn: excludedEntryIds },
      },
      orderBy: [{ enteredAt: "asc" }, { id: "asc" }],
    });

    if (!replacementEntry) {
      const expiredWinner = await tx.raffleWinner.update({
        where: { id: winner.id },
        data: { status: "EXPIRED" },
      });
      return { expiredWinner, replacementWinner: null };
    }

    // selectionRank is unique per raffle. Move the historical winner out of
    // the rank before creating its replacement, while retaining the original
    // rank in replacementWinner.selectionRank.
    await tx.raffleWinner.update({
      where: { id: winner.id },
      data: { selectionRank: 0, status: "EXPIRED" },
    });

    const replacementWinner = await tx.raffleWinner.create({
      data: {
        raffleId,
        entryId: replacementEntry.id,
        userId: replacementEntry.userId,
        walletAddressSnapshot: replacementEntry.walletAddressSnapshot,
        selectionRank: winner.selectionRank,
        status: "SELECTED",
        notificationStatus: "PENDING",
      },
    });

    await tx.raffleEntry.update({ where: { id: replacementEntry.id }, data: { status: "WINNER" } });

    const replacedWinner = await tx.raffleWinner.update({
      where: { id: winner.id },
      data: {
        status: "REPLACED",
        replacedByWinnerId: replacementWinner.id,
        replacementReason: "Claim window expired",
      },
    });

    return { expiredWinner: replacedWinner, replacementWinner };
  });
}
