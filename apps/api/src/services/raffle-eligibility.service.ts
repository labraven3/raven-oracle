
import { prisma } from "../lib/prisma.js";
import { verifyRaffleTask } from "./raffle-task-verification.service.js";

export async function verifyRaffleEligibility(
  raffleId: string,
  entryId: string,
  userId: string,
) {
  const raffle = await prisma.raffle.findUnique({
    where: { id: raffleId },
    include: {
      tasks: {
        orderBy: [
          { sortOrder: "asc" },
          { createdAt: "asc" },
        ],
      },
    },
  });

  if (!raffle) {
    throw new Error("Raffle not found");
  }

  const entry = await prisma.raffleEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry) {
    throw new Error("Raffle entry not found");
  }

  if (entry.userId !== userId) {
    throw new Error("Raffle entry does not belong to this user");
  }

  if (entry.raffleId !== raffleId) {
    throw new Error("Raffle entry does not belong to this raffle");
  }

  const results = [];

  for (const task of raffle.tasks) {
    try {
      const result = await verifyRaffleTask(
        task.id,
        entry.id,
        userId,
      );

      results.push({
        taskId: task.id,
        type: task.type,
        title: task.title,
        required: task.isRequired,
        verified: result.verified,
        ...(result.reason
          ? { reason: result.reason }
          : {}),
        ...(result.evidence
          ? { evidence: result.evidence }
          : {}),
      });
    } catch (error) {
      results.push({
        taskId: task.id,
        type: task.type,
        title: task.title,
        required: task.isRequired,
        verified: false,
        reason:
          error instanceof Error
            ? error.message
            : "Verification failed",
      });
    }
  }

  const requiredTasks = results.filter(
    (task) => task.required,
  );

  const failedRequiredTasks = requiredTasks.filter(
    (task) => !task.verified,
  );

  const allRequiredTasksVerified =
    failedRequiredTasks.length === 0;

  const verifiedCount = results.filter(
    (task) => task.verified,
  ).length;

  const eligibilityReasons = {
    checkedAt: new Date().toISOString(),
    allRequiredTasksVerified,
    verifiedCount,
    totalTasks: results.length,
    requiredTasks: requiredTasks.length,
    failedRequiredTasks: failedRequiredTasks.map(
      (task) => ({
        taskId: task.taskId,
        type: task.type,
        title: task.title,
        reason: task.reason ?? "Task not completed",
      }),
    ),
  };

  /*
   * Do not silently change unrelated raffle-entry state.
   *
   * socialVerifiedAtEntry means every required social task
   * has successfully passed at the time of this evaluation.
   */
  const updatedEntry = await prisma.raffleEntry.update({
    where: { id: entry.id },
    data: {
      socialVerifiedAtEntry: allRequiredTasksVerified,
      eligibilityReasons: eligibilityReasons,
    },
  });

  return {
    eligible: allRequiredTasksVerified,
    verifiedCount,
    totalTasks: results.length,
    requiredTasks: requiredTasks.length,
    failedRequiredTasks,
    tasks: results,
    entry: updatedEntry,
  };
}
