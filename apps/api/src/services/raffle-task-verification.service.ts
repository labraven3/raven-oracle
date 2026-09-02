import { prisma } from "../lib/prisma.js";

type VerificationResult = {
  verified: boolean;
  reason?: string;
  evidence?: Record<string, unknown>;
  manual?: boolean;
};

/**
 * Temporary task verification mode.
 *
 * Social APIs are intentionally NOT called here for now. A participant opens
 * the task link from the UI, waits briefly, and the task is marked verified.
 * This keeps the raffle flow simple while real X/Discord verification is
 * paused. Server-side ordering is still enforced by the task route.
 */
export async function verifyRaffleTask(
  taskId: string,
  entryId: string,
  userId: string,
): Promise<VerificationResult> {
  const task = await prisma.raffleTask.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, raffleId: true },
  });
  if (!task) throw new Error("Raffle task not found");

  const entry = await prisma.raffleEntry.findUnique({
    where: { id: entryId },
    select: { id: true, userId: true, raffleId: true },
  });
  if (!entry) throw new Error("Raffle entry not found");
  if (entry.userId !== userId) throw new Error("This raffle entry does not belong to you");
  if (entry.raffleId !== task.raffleId) throw new Error("Raffle task does not belong to this raffle entry");

  // Deliberate 2-second verification delay so the UI feels like it is
  // checking the task, without making any paid external API request.
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const evidence = {
    verificationMethod: "temporary_manual",
    verifiedAt: new Date().toISOString(),
    taskTitle: task.title,
  };

  await prisma.raffleTaskVerification.upsert({
    where: {
      raffleTaskId_entryId: {
        raffleTaskId: task.id,
        entryId,
      },
    },
    create: {
      raffleTaskId: task.id,
      entryId,
      userId,
      status: "VERIFIED",
      verifiedAt: new Date(),
      failureReason: null,
      evidence,
    },
    update: {
      status: "VERIFIED",
      verifiedAt: new Date(),
      failureReason: null,
      evidence,
    },
  });

  return {
    verified: true,
    manual: true,
    evidence,
  };
}
