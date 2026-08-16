-- CreateEnum
CREATE TYPE "RaffleTaskType" AS ENUM ('X_FOLLOW', 'X_LIKE', 'X_REPOST', 'DISCORD_JOIN');

-- CreateEnum
CREATE TYPE "RaffleTaskVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateTable
CREATE TABLE "RaffleTask" (
    "id" UUID NOT NULL,
    "raffleId" UUID NOT NULL,
    "type" "RaffleTaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "target" TEXT NOT NULL,
    "targetUrl" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaffleTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaffleTaskVerification" (
    "id" UUID NOT NULL,
    "raffleTaskId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "RaffleTaskVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaffleTaskVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RaffleTask_raffleId_idx" ON "RaffleTask"("raffleId");

-- CreateIndex
CREATE INDEX "RaffleTask_raffleId_sortOrder_idx" ON "RaffleTask"("raffleId", "sortOrder");

-- CreateIndex
CREATE INDEX "RaffleTask_type_idx" ON "RaffleTask"("type");

-- CreateIndex
CREATE INDEX "RaffleTaskVerification_entryId_idx" ON "RaffleTaskVerification"("entryId");

-- CreateIndex
CREATE INDEX "RaffleTaskVerification_userId_idx" ON "RaffleTaskVerification"("userId");

-- CreateIndex
CREATE INDEX "RaffleTaskVerification_status_idx" ON "RaffleTaskVerification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleTaskVerification_raffleTaskId_entryId_key" ON "RaffleTaskVerification"("raffleTaskId", "entryId");

-- AddForeignKey
ALTER TABLE "RaffleTask" ADD CONSTRAINT "RaffleTask_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleTaskVerification" ADD CONSTRAINT "RaffleTaskVerification_raffleTaskId_fkey" FOREIGN KEY ("raffleTaskId") REFERENCES "RaffleTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleTaskVerification" ADD CONSTRAINT "RaffleTaskVerification_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "RaffleEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleTaskVerification" ADD CONSTRAINT "RaffleTaskVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "RaffleWinner_active_raffle_selection_rank_key" RENAME TO "RaffleWinner_raffleId_selectionRank_key";
