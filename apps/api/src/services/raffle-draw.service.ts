import crypto from "node:crypto";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";

const ALGORITHM_VERSION = "sha256-csprng-v3";
const FCFS_ALGORITHM_VERSION = "fcfs-v1";

function hashEntryIds(entryIds: string[]) {
  return createHash("sha256").update(entryIds.join("\n")).digest("hex");
}

function seededRandomIndex(seed: Buffer, max: number, counter: number) {
  if (max <= 0) throw new Error("Cannot select from an empty set");
  const limit = Math.floor(0x100000000 / max) * max;
  let attempt = 0;
  while (true) {
    const digest = createHash("sha256")
      .update(seed)
      .update(Buffer.from(`|draw:${counter}:attempt:${attempt}`, "utf8"))
      .digest();
    const value = digest.readUInt32BE(0);
    if (value < limit) return value % max;
    attempt += 1;
  }
}

export async function drawRaffle(raffleId: string, requestingUserId: string) {
  return prisma.$transaction(async (tx) => {
    const raffle = await tx.raffle.findUnique({ where: { id: raffleId } });
    if (!raffle) throw new Error("Raffle not found");
    if (raffle.createdByUserId !== requestingUserId) throw new Error("Only the raffle creator can draw this raffle");
    if (raffle.status === "COMPLETED") throw new Error("Raffle has already been drawn");
    if (raffle.status === "CANCELLED") throw new Error("Cancelled raffle cannot be drawn");
    if (raffle.status !== "CLOSED") throw new Error("Raffle must be closed before drawing winners");
    if (new Date() < raffle.endsAt) throw new Error("Raffle end time has not been reached");

    const claimed = await tx.raffle.updateMany({
      where: { id: raffleId, status: "CLOSED" },
      data: { status: "DRAWING" },
    });
    if (claimed.count !== 1) {
      throw new Error("Raffle draw is already in progress or is no longer drawable");
    }

    const pendingCount = await tx.raffleEntry.count({ where: { raffleId, status: "PENDING" } });
    if (pendingCount > 0) {
      throw new Error(`Raffle has ${pendingCount} unevaluated entr${pendingCount === 1 ? "y" : "ies"}; evaluate entries before drawing`);
    }

    const eligibleEntries = await tx.raffleEntry.findMany({
      where: {
        raffleId,
        status: "ELIGIBLE",
        walletAddressId: { not: null },
        walletAddressSnapshot: { not: null },
      },
      orderBy: [{ enteredAt: "asc" }, { id: "asc" }],
      select: { id: true, userId: true, walletAddressSnapshot: true, enteredAt: true },
    });
    if (eligibleEntries.length === 0) throw new Error("No eligible entries with payout wallets available");

    const entryRules = raffle.entryRules && typeof raffle.entryRules === "object" && !Array.isArray(raffle.entryRules)
      ? raffle.entryRules as Record<string, unknown>
      : {};
    const raffleType = entryRules.raffleType === "FCFS" ? "FCFS" : "RAFFLE";
    const winnerCount = Math.min(raffle.winnerCount, eligibleEntries.length);
    const entryIds = eligibleEntries.map((entry) => entry.id);
    const eligibleEntryIdsHash = hashEntryIds(entryIds);
    const randomness = crypto.randomBytes(32);
    const randomnessValueHash = createHash("sha256").update(randomness).digest("hex");
    const selectedIndexes: number[] = [];
    const remaining = eligibleEntries.map((entry, index) => ({ entry, originalIndex: index }));

    for (let rank = 1; rank <= winnerCount; rank++) {
      const index = raffleType === "FCFS" ? 0 : seededRandomIndex(randomness, remaining.length, rank);
      const selected = remaining.splice(index, 1)[0];
      if (!selected?.entry.walletAddressSnapshot) throw new Error("Winner selection failed: payout wallet missing");
      selectedIndexes.push(selected.originalIndex);

      await tx.raffleWinner.create({
        data: {
          raffleId,
          entryId: selected.entry.id,
          userId: selected.entry.userId,
          walletAddressSnapshot: selected.entry.walletAddressSnapshot,
          selectionRank: rank,
          status: "SELECTED",
          notificationStatus: "PENDING",
        },
      });
      await tx.raffleEntry.update({ where: { id: selected.entry.id }, data: { status: "WINNER" } });
    }

    await tx.raffleEntry.updateMany({ where: { raffleId, status: "ELIGIBLE" }, data: { status: "NOT_SELECTED" } });

    const algorithmVersion = raffleType === "FCFS" ? FCFS_ALGORITHM_VERSION : ALGORITHM_VERSION;
    const snapshot = await tx.raffleEligibilitySnapshot.create({
      data: {
        raffleId,
        eligibleEntryCount: eligibleEntries.length,
        eligibleEntryIdsHash,
        randomnessSource: raffleType === "FCFS" ? "entry-order" : "node:crypto.randomBytes",
        randomnessRequestRef: null,
        randomnessValueHash,
        algorithmVersion,
        winnerIndexResults: selectedIndexes,
      },
    });

    const updatedRaffle = await tx.raffle.update({
      where: { id: raffleId },
      data: { status: "COMPLETED", fairnessAlgorithmVersion: algorithmVersion },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: requestingUserId,
        action: "RAFFLE_WINNER_SELECTED",
        entityType: "Raffle",
        entityId: raffleId,
        summary: `Drew ${winnerCount} winner(s) from ${eligibleEntries.length} eligible entries`,
        metadata: {
          winnerCount,
          eligibleEntryCount: eligibleEntries.length,
          algorithmVersion,
          eligibleEntryIdsHash,
          randomnessSource: raffleType === "FCFS" ? "entry-order" : "node:crypto.randomBytes",
          randomnessValueHash,
          snapshotId: snapshot.id,
          winnerIndexes: selectedIndexes,
        },
      },
    });

    const winners = await tx.raffleWinner.findMany({ where: { raffleId }, orderBy: { selectionRank: "asc" } });
    return { raffle: updatedRaffle, snapshot, winners };
  });
}
