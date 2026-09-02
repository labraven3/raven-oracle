import { prisma } from "../lib/prisma.js";

type VerificationResult = {
  verified: boolean;
  reason?: string;
  evidence?: Record<string, unknown>;
  manual?: boolean;
};

/**
 * Temporary social-task verification.
 *
 * IMPORTANT: X and Discord APIs are deliberately NOT called here.
 * X_FOLLOW, X_LIKE, X_REPOST and DISCORD_JOIN all use the exact same
 * simulated verification flow: open the target link in the UI, wait 2s,
 * then persist a VERIFIED task record.
 */
export async function verifyRaffleTask(
  taskId: string,
  entryId: string,
  userId: string,
): Promise<VerificationResult> {
  const task = await prisma.raffleTask.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, type: true, raffleId: true },
  });
  if (!task) throw new Error("Raffle task not found");

  const entry = await prisma.raffleEntry.findUnique({
    where: { id: entryId },
    select: { id: true, userId: true, raffleId: true },
  });
  if (!entry) throw new Error("Raffle entry not found");
  if (entry.userId !== userId) throw new Error("This raffle entry does not belong to you");
  if (entry.raffleId !== task.raffleId) throw new Error("Raffle task does not belong to this raffle entry");

  // No external request. This is intentionally identical for Follow/Like/Repost/Discord.
  const verifiedAt = new Date();
  const evidence = {
    verificationMethod: "simulated_social_task",
    externalApiCalled: false,
    taskType: task.type,
    verifiedAt: verifiedAt.toISOString(),
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
      verifiedAt,
      failureReason: null,
      evidence,
    },
    update: {
      status: "VERIFIED",
      verifiedAt,
      failureReason: null,
      evidence,
    },
  });

  // Keep the entry's social flag in sync from persisted task records only.
  // This is a DB read, not an X/Discord verification call.
  const requiredTasks = await prisma.raffleTask.findMany({
    where: { raffleId: task.raffleId, isRequired: true },
    select: { id: true },
  });
  const verifiedRequired = await prisma.raffleTaskVerification.count({
    where: {
      entryId,
      status: "VERIFIED",
      raffleTaskId: { in: requiredTasks.map((item) => item.id) },
    },
  });

  await prisma.raffleEntry.update({
    where: { id: entryId },
    data: {
      socialVerifiedAtEntry: verifiedRequired === requiredTasks.length,
    },
  });

  return {
    verified: true,
    manual: true,
    evidence,
  };
}
