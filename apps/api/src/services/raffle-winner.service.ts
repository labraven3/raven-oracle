import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { sendWinnerNotification } from "./email.service.js";

class WinnerNotificationError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "WinnerNotificationError";
    this.status = status;
  }
}

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

  if (!winner) throw new WinnerNotificationError("Winner not found", 404);
  if (!["SELECTED", "NOTIFIED"].includes(winner.status)) {
    throw new WinnerNotificationError(
      `Winner cannot be notified from status ${winner.status}`,
      409,
    );
  }
  if (!winner.user.email) {
    throw new WinnerNotificationError(
      "This winner does not have an email address on their Raven Oracle account.",
      422,
    );
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

    console.error("Winner notification delivery failed:", error);
    throw new WinnerNotificationError(
      "Winner email could not be sent. Check the Raven Oracle email delivery configuration and try again.",
      503,
    );
  }
}
