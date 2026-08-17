-- Historical EXPIRED/REPLACED winners may reuse the same selection rank.
-- Only currently active winner states require a unique rank per raffle.

DROP INDEX IF EXISTS "RaffleWinner_raffleId_selectionRank_key";

DROP INDEX IF EXISTS "RaffleWinner_active_raffle_selection_rank_key";

CREATE UNIQUE INDEX "RaffleWinner_active_raffle_selection_rank_key"
ON "RaffleWinner" ("raffleId", "selectionRank")
WHERE "status" IN ('SELECTED', 'NOTIFIED', 'CLAIMED');
