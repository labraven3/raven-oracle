import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { sendWinnerNotification } from "./email.service.js";

/**
 * NFT raffle winner model:
 * - SELECTED = winner has been drawn and is the official winner.
 * - NOTIFIED = Raven Oracle has successfully emailed the winner.
 *
 * There is intentionally NO claim deadline, claim button, expiration, or
 * automatic replacement. The winner's wallet is the deliverable used by the
 * project to whitelist the winner.
 */
export async function notifyWinner(raffleId: string, winnerId: string) {
  const winner = await prisma.raffleWinner.findFirst({
    where: { id: winnerId, raffleId },
    include: { user: true, raffle: true },
  });

  if (!winner) throw new Error("Winner not found");
  if (!["SELECTED", "NOTIFIED"].includes(winner.status)) {
    throw new Error(`Winner cannot be notified from status ${winner.status}`);
  }
  if (!winner.user.email || !winner.user.emailVerifiedAt) {
    throw new Error("Winner must have a verified Raven Oracle email before notification");
  }

  try {
    await sendWinnerNotification(
      winner.user.email,
      winner.raffle.title,
      winner.raffle.prizeName,
      `${env.WEB_ORIGIN}/raffles/${raffleId}/winners`,
    );

    return prisma.raffleWinner.update({
      where: { id: winner.id },
      data: {
        status: "NOTIFIED",
        notifiedAt: winner.notifiedAt ?? new Date(),
        notificationStatus: "SENT",
      },
    });
  } catch (error) {
    await prisma.raffleWinner.update({
      where: { id: winner.id },
      data: { notificationStatus: "FAILED" },
    });
    throw error;
  }
}
