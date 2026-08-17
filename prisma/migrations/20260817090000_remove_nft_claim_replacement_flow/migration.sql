-- NFT whitelist raffles do not have a claim/expiration/replacement workflow.
-- Winners remain selected permanently; the wallet snapshot is the whitelist deliverable.

ALTER TABLE "RaffleWinner" DROP COLUMN IF EXISTS "claimedAt";
ALTER TABLE "RaffleWinner" DROP COLUMN IF EXISTS "claimReference";
ALTER TABLE "RaffleWinner" DROP COLUMN IF EXISTS "replacedByWinnerId";
ALTER TABLE "RaffleWinner" DROP COLUMN IF EXISTS "replacementReason";

DROP INDEX IF EXISTS "RaffleWinner_raffleId_selectionRank_key";
DROP INDEX IF EXISTS "RaffleWinner_raffleId_entryId_key";

-- Recreate the winner status enum without claim/expiration/replacement states.
CREATE TYPE "RaffleWinnerStatus_new" AS ENUM ('SELECTED', 'NOTIFIED', 'DISQUALIFIED');
ALTER TABLE "RaffleWinner" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RaffleWinner" ALTER COLUMN "status" TYPE "RaffleWinnerStatus_new" USING (
  CASE "status"::text
    WHEN 'SELECTED' THEN 'SELECTED'
    WHEN 'NOTIFIED' THEN 'NOTIFIED'
    WHEN 'DISQUALIFIED' THEN 'DISQUALIFIED'
    ELSE 'SELECTED'
  END
)::"RaffleWinnerStatus_new";
DROP TYPE "RaffleWinnerStatus";
ALTER TYPE "RaffleWinnerStatus_new" RENAME TO "RaffleWinnerStatus";
ALTER TABLE "RaffleWinner" ALTER COLUMN "status" SET DEFAULT 'SELECTED';

-- The audit action for replacing a winner is no longer part of the NFT raffle lifecycle.
CREATE TYPE "AuditAction_new" AS ENUM (
  'USER_SUSPENDED', 'USER_BANNED', 'PROJECT_APPROVED', 'PROJECT_REJECTED',
  'ALPHA_VERIFIED', 'ALPHA_REJECTED', 'POINTS_AWARDED', 'POINTS_DEDUCTED',
  'RAFFLE_CREATED', 'RAFFLE_UPDATED', 'RAFFLE_CANCELLED', 'RAFFLE_WINNER_SELECTED',
  'CHAT_MESSAGE_MODERATED', 'ADMIN_ACTION'
);
ALTER TABLE "AuditLog" ALTER COLUMN "action" DROP DEFAULT;
ALTER TABLE "AuditLog" ALTER COLUMN "action" TYPE "AuditAction_new" USING (
  CASE "action"::text
    WHEN 'USER_SUSPENDED' THEN 'USER_SUSPENDED'
    WHEN 'USER_BANNED' THEN 'USER_BANNED'
    WHEN 'PROJECT_APPROVED' THEN 'PROJECT_APPROVED'
    WHEN 'PROJECT_REJECTED' THEN 'PROJECT_REJECTED'
    WHEN 'ALPHA_VERIFIED' THEN 'ALPHA_VERIFIED'
    WHEN 'ALPHA_REJECTED' THEN 'ALPHA_REJECTED'
    WHEN 'POINTS_AWARDED' THEN 'POINTS_AWARDED'
    WHEN 'POINTS_DEDUCTED' THEN 'POINTS_DEDUCTED'
    WHEN 'RAFFLE_CREATED' THEN 'RAFFLE_CREATED'
    WHEN 'RAFFLE_UPDATED' THEN 'RAFFLE_UPDATED'
    WHEN 'RAFFLE_CANCELLED' THEN 'RAFFLE_CANCELLED'
    WHEN 'RAFFLE_WINNER_SELECTED' THEN 'RAFFLE_WINNER_SELECTED'
    WHEN 'CHAT_MESSAGE_MODERATED' THEN 'CHAT_MESSAGE_MODERATED'
    WHEN 'ADMIN_ACTION' THEN 'ADMIN_ACTION'
    ELSE 'ADMIN_ACTION'
  END
)::"AuditAction_new";
DROP TYPE "AuditAction";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";
