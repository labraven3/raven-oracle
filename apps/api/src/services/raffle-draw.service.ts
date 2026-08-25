import crypto from "node:crypto";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";

const ALGORITHM_VERSION = "sha256-csprng-v1";
const FCFS_ALGORITHM_VERSION = "fcfs-v1";

function hashEntryIds(entryIds: string[]) { return createHash("sha256").update(entryIds.join("\n")).digest("hex"); }
function randomIndex(randomBytes: Buffer, max: number) { if (max <= 0) throw new Error("Cannot select from an empty set"); const range = Math.floor(256 / max) * max; for (let i = 0; i < randomBytes.length; i++) { const value = randomBytes[i]; if (value !== undefined && value < range) return value % max; } return randomIndex(crypto.randomBytes(32), max); }

export async function drawRaffle(raffleId: string, requestingUserId: string) {
  return prisma.$transaction(async (tx) => {
    const raffle = await tx.raffle.findUnique({ where: { id: raffleId } });
    if (!raffle) throw new Error("Raffle not found");
    if (raffle.createdByUserId !== requestingUserId) throw new Error("Only the raffle creator can draw this raffle");
    if (raffle.status === "COMPLETED") throw new Error("Raffle has already been drawn");
    if (raffle.status === "CANCELLED") throw new Error("Cancelled raffle cannot be drawn");
    if (raffle.status !== "CLOSED") throw new Error("Raffle must be closed before drawing winners");
    if (new Date() < raffle.endsAt) throw new Error("Raffle end time has not been reached");

    const eligibleEntries = await tx.raffleEntry.findMany({
      where: { raffleId, status: "ELIGIBLE", walletAddressId: { not: null }, walletAddressSnapshot: { not: null } },
      orderBy: { enteredAt: "asc" },
      select: { id: true, userId: true, walletAddressSnapshot: true, enteredAt: true },
    });
    if (eligibleEntries.length === 0) throw new Error("No eligible entries with payout wallets available");

    const entryRules = raffle.entryRules && typeof raffle.entryRules === "object" && !Array.isArray(raffle.entryRules) ? raffle.entryRules as Record<string, unknown> : {};
    const raffleType = entryRules.raffleType === "FCFS" ? "FCFS" : "RAFFLE";
    const winnerCount = Math.min(raffle.winnerCount, eligibleEntries.length);
    const entryIds = eligibleEntries.map((entry) => entry.id);
    const eligibleEntryIdsHash = hashEntryIds(entryIds);
    const randomness = crypto.randomBytes(32);
    const randomnessValueHash = createHash("sha256").update(randomness).digest("hex");
    const selectedIndexes: number[] = [];
    const remaining = [...eligibleEntries];

    for (let rank = 1; rank <= winnerCount; rank++) {
      const index = raffleType === "FCFS" ? rank - 1 : randomIndex(randomness, remaining.length);
      selectedIndexes.push(index);
      const selected = remaining.splice(index, 1)[0];
      if (!selected || !selected.walletAddressSnapshot) throw new Error("Winner selection failed: payout wallet missing");
      await tx.raffleWinner.create({ data: { raffleId, entryId: selected.id, userId: selected.userId, walletAddressSnapshot: selected.walletAddressSnapshot, selectionRank: rank, status: "SELECTED", notificationStatus: "PENDING" } });
      await tx.raffleEntry.update({ where: { id: selected.id }, data: { status: "WINNER" } });
    }

    await tx.raffleEntry.updateMany({ where: { raffleId, status: "ELIGIBLE" }, data: { status: "NOT_SELECTED" } });
    const snapshot = await tx.raffleEligibilitySnapshot.create({ data: { raffleId, eligibleEntryCount: eligibleEntries.length, eligibleEntryIdsHash, randomnessSource: raffleType === "FCFS" ? "entry-order" : "node:crypto.randomBytes", randomnessRequestRef: null, randomnessValueHash, algorithmVersion: raffleType === "FCFS" ? FCFS_ALGORITHM_VERSION : ALGORITHM_VERSION, winnerIndexResults: selectedIndexes } });
    const updatedRaffle = await tx.raffle.update({ where: { id: raffleId }, data: { status: "COMPLETED", fairnessAlgorithmVersion: raffleType === "FCFS" ? FCFS_ALGORITHM_VERSION : ALGORITHM_VERSION } });
    const winners = await tx.raffleWinner.findMany({ where: { raffleId }, orderBy: { selectionRank: "asc" } });
    return { raffle: updatedRaffle, snapshot, winners };
  });
}
