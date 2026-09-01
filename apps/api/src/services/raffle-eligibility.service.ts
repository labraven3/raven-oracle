import { prisma } from "../lib/prisma.js";
import { evaluateRaffleEntry } from "./eligibility.service.js";

export async function verifyRaffleEligibility(raffleId: string, entryId: string, userId: string) {
  const raffle = await prisma.raffle.findUnique({
    where: { id: raffleId },
    include: { tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  if (!raffle) throw new Error("Raffle not found");
  const now = new Date();
  if (raffle.status !== "ACTIVE") throw new Error(raffle.status === "SCHEDULED" ? "Raffle has not started yet" : "Raffle is not accepting verification");
  if (now < raffle.startsAt) throw new Error("Raffle has not started yet");
  if (now > raffle.endsAt) throw new Error("Raffle has ended");

  const entry = await prisma.raffleEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("Raffle entry not found");
  if (entry.userId !== userId) throw new Error("Raffle entry does not belong to this user");
  if (entry.raffleId !== raffleId) throw new Error("Raffle entry does not belong to this raffle");

  // IMPORTANT: this endpoint is now a READ/eligibility pass, not an external
  // verification loop. Individual task verification is performed only by
  // POST /tasks/:taskId/verify. Re-running verification here was causing one
  // UI refresh to hit every X task again and was the source of the API-cost bug.
  const stored = await prisma.raffleTaskVerification.findMany({
    where: { entryId: entry.id, raffleTaskId: { in: raffle.tasks.map((task) => task.id) } },
    select: { raffleTaskId: true, status: true, verifiedAt: true, failureReason: true, evidence: true },
  });
  const byTask = new Map(stored.map((row) => [row.raffleTaskId, row]));

  const results = raffle.tasks.map((task) => {
    const verification = byTask.get(task.id);
    const verified = verification?.status === "VERIFIED";
    return {
      taskId: task.id,
      type: task.type,
      title: task.title,
      required: task.isRequired,
      verified,
      ...(verification?.failureReason ? { reason: verification.failureReason } : {}),
      ...(verification?.evidence ? { evidence: verification.evidence } : {}),
      ...(verification?.verifiedAt ? { verifiedAt: verification.verifiedAt } : {}),
    };
  });

  const requiredTasks = results.filter((task) => task.required);
  const failedRequiredTasks = requiredTasks.filter((task) => !task.verified);
  const allRequiredTasksVerified = failedRequiredTasks.length === 0;
  const verifiedCount = results.filter((task) => task.verified).length;
  const taskReasons = {
    checkedAt: new Date().toISOString(),
    allRequiredTasksVerified,
    verifiedCount,
    totalTasks: results.length,
    requiredTasks: requiredTasks.length,
    failedRequiredTasks: failedRequiredTasks.map((task) => ({ taskId: task.taskId, type: task.type, title: task.title, reason: task.reason ?? "Task not completed" })),
  };

  await prisma.raffleEntry.update({
    where: { id: entry.id },
    data: {
      status: "PENDING",
      socialVerifiedAtEntry: allRequiredTasksVerified,
      eligibilityCheckedAt: new Date(),
      eligibilityReasons: taskReasons,
    },
  });

  const finalEligibility = await evaluateRaffleEntry(entry.id);
  const refreshedEntry = await prisma.raffleEntry.findUnique({ where: { id: entry.id } });

  return {
    eligible: allRequiredTasksVerified && finalEligibility.status === "ELIGIBLE",
    allRequiredTasksVerified,
    verifiedCount,
    totalTasks: results.length,
    requiredTasks: requiredTasks.length,
    failedRequiredTasks,
    tasks: results,
    eligibility: finalEligibility,
    entry: refreshedEntry,
  };
}
