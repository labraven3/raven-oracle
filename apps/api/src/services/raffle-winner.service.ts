import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";

function createClaimReference() {
  return `RAVEN-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

export async function notifyRaffleWinner(
  raffleId: string,
  winnerId: string,
) {
  const winner = await prisma.raffleWinner.findUnique({
    where: {
      id: winnerId,
    },
  });

  if (!winner || winner.raffleId !== raffleId) {
    throw new Error("Raffle winner not found");
  }

  if (winner.status !== "SELECTED") {
    throw new Error(
      `Winner cannot be notified while in ${winner.status} status`,
    );
  }

  const updated = await prisma.raffleWinner.update({
    where: {
      id: winner.id,
    },
    data: {
      status: "NOTIFIED",
      notificationStatus: "SENT",
      notifiedAt: new Date(),
    },
  });

  return updated;
}

export async function claimRaffleWinner(
  raffleId: string,
  winnerId: string,
  requestingUserId: string,
) {
  return prisma.$transaction(async (tx) => {
    const winner = await tx.raffleWinner.findUnique({
      where: {
        id: winnerId,
      },
      include: {
        raffle: true,
      },
    });

    if (!winner || winner.raffleId !== raffleId) {
      throw new Error("Raffle winner not found");
    }

    if (winner.userId !== requestingUserId) {
      throw new Error("Only the selected winner can claim this prize");
    }

    if (winner.status === "CLAIMED") {
      return winner;
    }

    if (winner.status !== "SELECTED" && winner.status !== "NOTIFIED") {
      throw new Error(
        `Winner cannot be claimed while in ${winner.status} status`,
      );
    }

    const claimReference = createClaimReference();

    const claimed = await tx.raffleWinner.update({
      where: {
        id: winner.id,
      },
      data: {
        status: "CLAIMED",
        claimedAt: new Date(),
        claimReference,
      },
    });

    return claimed;
  });
}
