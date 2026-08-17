-- NFT whitelist raffles do not use a claim/expiry/replacement flow.
-- A selected winner remains the winner; email is notification only.

ALTER TABLE "RaffleWinner" DROP COLUMN IF EXISTS "claimedAt";
ALTER TABLE "RaffleWinner" DROP COLUMN IF EXISTS "claimReference";
ALTER TABLE "RaffleWinner" DROP COLUMN IF EXISTS "replacedByWinnerId";
ALTER TABLE "RaffleWinner" DROP COLUMN IF EXISTS "replacementReason";

ALTER TABLE "RaffleWinner" DROP CONSTRAINT IF EXISTS "RaffleWinner_replacedByWinnerId_fkey";
DROP INDEX IF EXISTS "RaffleWinner_replacedByWinnerId_idx";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RaffleWinnerStatus') THEN
    CREATE TYPE "RaffleWinnerStatus_new" AS ENUM ('SELECTED', 'NOTIFIED', 'DISQUALIFIED');
    ALTER TABLE "RaffleWinner"
      ALTER COLUMN "status" DROP DEFAULT,
      ALTER COLUMN "status" TYPE "RaffleWinnerStatus_new"
      USING (CASE WHEN "status"::text IN ('SELECTED','NOTIFIED','DISQUALIFIED') THEN "status"::text ELSE 'SELECTED' END)::"RaffleWinnerStatus_new";
    ALTER TABLE "RaffleWinner" ALTER COLUMN "status" SET DEFAULT 'SELECTED';
    DROP TYPE "RaffleWinnerStatus";
    ALTER TYPE "RaffleWinnerStatus_new" RENAME TO "RaffleWinnerStatus";
  END IF;
END $$;

-- The audit event is no longer emitted for NFT winner replacement.
-- Existing historical audit rows remain intact for auditability.
