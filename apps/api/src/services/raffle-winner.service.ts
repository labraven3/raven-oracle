import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function notifyWinner(
  raffleId: string,
  winnerId: string,
) {
  return prisma.$transaction(async (tx) => {
    const winner = await tx.raffleWinner.findFirst({
      where: {
        id: winnerId,
        raffleId,
      },
    });

    if (!winner) {
      throw new Error("Winner not found");
    }

    if (
      winner.status === "CLAIMED" ||
      winner.status === "EXPIRED" ||
      winner.status === "REPLACED"
    ) {
      throw new Error(`Winner cannot be notified from status ${winner.status}`);
    }

    const updated = await tx.raffleWinner.update({
      where: { id: winner.id },
      data: {
        status: "NOTIFIED",
        notifiedAt: new Date(),
        notificationStatus: "SENT",
      },
    });

    return updated;
  });
}

export async function claimWinner(
  raffleId: string,
  winnerId: string,
  requestingUserId: string,
) {
  return prisma.$transaction(async (tx) => {
    const winner = await tx.raffleWinner.findFirst({
      where: {
        id: winnerId,
        raffleId,
        userId: requestingUserId,
      },
    });

    if (!winner) {
      throw new Error("Winner not found");
    }

    if (winner.status === "CLAIMED") {
      return winner;
    }

    if (winner.status === "EXPIRED" || winner.status === "REPLACED") {
      throw new Error(`Winner is ${winner.status.toLowerCase()}`);
    }

    const deadlineSource =
      winner.notifiedAt ?? winner.selectedAt;

    const deadline =
      new Date(deadlineSource.getTime() + CLAIM_WINDOW_MS);

    if (new Date() > deadline) {
      const expired = await tx.raffleWinner.update({
        where: { id: winner.id },
        data: {
          status: "EXPIRED",
        },
      });

      throw new Error("Winner claim window has expired");
    }

    const claimReference =
      `RAVEN-${cryptoReference()}`;

    const claimed = await tx.raffleWinner.update({
      where: { id: winner.id },
      data: {
        status: "CLAIMED",
        claimedAt: new Date(),
        claimReference,
      },
    });

    return claimed;
  });
}

function cryptoReference() {
  return Math.random()
    .toString(36)
    .slice(2, 14)
    .toUpperCase();
}

export async function expireAndReplaceWinner(
  raffleId: string,
  winnerId: string,
) {
  return prisma.$transaction(async (tx) => {
    const winner = await tx.raffleWinner.findFirst({
      where: {
        id: winnerId,
        raffleId,
      },
    });

    if (!winner) {
      throw new Error("Winner not found");
    }

    if (winner.status === "CLAIMED") {
      throw new Error("Claimed winner cannot be expired");
    }

    if (
      winner.status === "EXPIRED" ||
      winner.status === "REPLACED"
    ) {
      throw new Error(`Winner is already ${winner.status.toLowerCase()}`);
    }

    const deadlineSource =
      winner.notifiedAt ?? winner.selectedAt;

    const deadline =
      new Date(deadlineSource.getTime() + CLAIM_WINDOW_MS);

    if (new Date() <= deadline) {
      throw new Error("Winner claim window has not expired");
    }

    const replacementEntry = await tx.raffleEntry.findFirst({
      where: {
        raffleId,
        status: "ELIGIBLE",
        id: {
          notIn: [
            ...(await tx.raffleWinner.findMany({
              where: { raffleId },
              select: { entryId: true },
            })).map((item) => item.entryId),
          ],
        },
      },
      orderBy: {
        enteredAt: "asc",
      },
    });

    const expiredWinner = await tx.raffleWinner.update({
      where: { id: winner.id },
      data: {
        status: "EXPIRED",
      },
    });

    if (!replacementEntry) {
      return {
        expiredWinner,
        replacementWinner: null,
      };
    }

    const replacementWinner = await tx.raffleWinner.create({
      data: {
        raffleId,
        entryId: replacementEntry.id,
        userId: replacementEntry.userId,
        walletAddressSnapshot:
          replacementEntry.walletAddressSnapshot,
        selectionRank: winner.selectionRank,
        status: "SELECTED",
        notificationStatus: "PENDING",
      },
    });

    await tx.raffleEntry.update({
      where: {
        id: replacementEntry.id,
      },
      data: {
        status: "WINNER",
      },
    });

    await tx.raffleWinner.update({
      where: {
        id: winner.id,
      },
      data: {
        replacedByWinnerId: replacementWinner.id,
        replacementReason: "Claim window expired",
      },
    });

    return {
      expiredWinner: await tx.raffleWinner.findUnique({
        where: { id: winner.id },
      }),
      replacementWinner,
    };
  });
}
