-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'DISCORD', 'X');

-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('DISCORD', 'X');

-- CreateEnum
CREATE TYPE "WalletChain" AS ENUM ('EVM', 'SOLANA');

-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectCategory" AS ENUM ('NFT', 'TOKEN', 'GAME', 'TOOL', 'DEFI', 'COMMUNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "RatingStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "RaffleStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'CLOSED', 'DRAWING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RaffleEntryStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'INELIGIBLE', 'DISQUALIFIED', 'WINNER', 'NOT_SELECTED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RaffleWinnerStatus" AS ENUM ('SELECTED', 'NOTIFIED', 'CLAIMED', 'EXPIRED', 'REPLACED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AlphaSubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'DUPLICATE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('MINT', 'AIRDROP', 'WL', 'TRADING', 'TOOL', 'SECURITY', 'OTHER');

-- CreateEnum
CREATE TYPE "PointTransactionType" AS ENUM ('ALPHA_VERIFIED', 'RAFFLE_REWARD', 'WL_REDEMPTION', 'ADMIN_ADJUSTMENT', 'PENALTY', 'REVERSAL');

-- CreateEnum
CREATE TYPE "ChatChannelType" AS ENUM ('GENERAL', 'PROJECT', 'RAFFLE', 'ADMIN');

-- CreateEnum
CREATE TYPE "ChatBridgeSource" AS ENUM ('WEB', 'DISCORD');

-- CreateEnum
CREATE TYPE "ChatMessageStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'REMOVED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_SUSPENDED', 'USER_BANNED', 'PROJECT_APPROVED', 'PROJECT_REJECTED', 'ALPHA_VERIFIED', 'ALPHA_REJECTED', 'POINTS_AWARDED', 'POINTS_DEDUCTED', 'RAFFLE_CREATED', 'RAFFLE_UPDATED', 'RAFFLE_CANCELLED', 'RAFFLE_WINNER_SELECTED', 'RAFFLE_WINNER_REPLACED', 'CHAT_MESSAGE_MODERATED', 'ADMIN_ACTION');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "providerUsername" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletAddress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "chain" "WalletChain" NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "normalizedAddress" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "ownershipVerifiedAt" TIMESTAMP(3),
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WalletAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "websiteUrl" TEXT,
    "xUrl" TEXT,
    "discordUrl" TEXT,
    "logoUrl" TEXT,
    "category" "ProjectCategory" NOT NULL DEFAULT 'OTHER',
    "status" "ProjectStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedByUserId" UUID,
    "approvedByUserId" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRating" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "RatingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Raffle" (
    "id" UUID NOT NULL,
    "projectId" UUID,
    "createdByUserId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "prizeName" TEXT NOT NULL,
    "prizeDescription" TEXT,
    "prizeQuantity" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "entryRules" JSONB NOT NULL,
    "status" "RaffleStatus" NOT NULL DEFAULT 'DRAFT',
    "maxEntriesPerUser" INTEGER NOT NULL DEFAULT 1,
    "winnerCount" INTEGER NOT NULL DEFAULT 1,
    "fairnessAlgorithmVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Raffle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaffleEntry" (
    "id" UUID NOT NULL,
    "raffleId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "walletAddressId" UUID NOT NULL,
    "walletAddressSnapshot" TEXT NOT NULL,
    "status" "RaffleEntryStatus" NOT NULL DEFAULT 'PENDING',
    "eligibilityCheckedAt" TIMESTAMP(3),
    "eligibilityReasons" JSONB,
    "captchaProvider" TEXT,
    "captchaVerificationRef" TEXT,
    "captchaPassed" BOOLEAN,
    "riskScore" INTEGER,
    "riskLevel" "RiskLevel",
    "riskSignals" JSONB,
    "ipRiskHash" TEXT,
    "deviceRiskIdHash" TEXT,
    "accountAgeDaysAtEntry" INTEGER,
    "walletAgeDaysAtEntry" INTEGER,
    "socialVerifiedAtEntry" BOOLEAN NOT NULL DEFAULT false,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaffleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaffleWinner" (
    "id" UUID NOT NULL,
    "raffleId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "walletAddressSnapshot" TEXT NOT NULL,
    "selectionRank" INTEGER NOT NULL,
    "status" "RaffleWinnerStatus" NOT NULL DEFAULT 'SELECTED',
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "notificationStatus" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "claimedAt" TIMESTAMP(3),
    "claimReference" TEXT,
    "replacedByWinnerId" UUID,
    "replacementReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaffleWinner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaffleEligibilitySnapshot" (
    "id" UUID NOT NULL,
    "raffleId" UUID NOT NULL,
    "eligibleEntryCount" INTEGER NOT NULL,
    "eligibleEntryIdsHash" TEXT NOT NULL,
    "snapshotJsonRef" TEXT,
    "randomnessSource" TEXT NOT NULL,
    "randomnessRequestRef" TEXT,
    "randomnessValueHash" TEXT,
    "algorithmVersion" TEXT NOT NULL,
    "winnerIndexResults" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaffleEligibilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlphaSubmission" (
    "id" UUID NOT NULL,
    "submittedByUserId" UUID NOT NULL,
    "projectId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceLinks" JSONB NOT NULL,
    "opportunityType" "OpportunityType" NOT NULL,
    "expectedResult" TEXT,
    "status" "AlphaSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "pointsAwarded" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AlphaSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "PointTransactionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "alphaSubmissionId" UUID,
    "raffleId" UUID,
    "auditLogId" UUID,
    "createdByUserId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatChannel" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ChatChannelType" NOT NULL DEFAULT 'GENERAL',
    "projectId" UUID,
    "raffleId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "moderationStatus" "ChatMessageStatus" NOT NULL DEFAULT 'VISIBLE',
    "moderatedByUserId" UUID,
    "moderatedAt" TIMESTAMP(3),
    "discordMessageId" TEXT,
    "discordChannelId" TEXT,
    "bridgeSource" "ChatBridgeSource" NOT NULL DEFAULT 'WEB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "riskContext" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "SocialAccount_userId_idx" ON "SocialAccount"("userId");

-- CreateIndex
CREATE INDEX "SocialAccount_provider_idx" ON "SocialAccount"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_provider_providerAccountId_key" ON "SocialAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "WalletAddress_userId_idx" ON "WalletAddress"("userId");

-- CreateIndex
CREATE INDEX "WalletAddress_chain_idx" ON "WalletAddress"("chain");

-- CreateIndex
CREATE INDEX "WalletAddress_status_idx" ON "WalletAddress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WalletAddress_chain_normalizedAddress_key" ON "WalletAddress"("chain", "normalizedAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_category_idx" ON "Project"("category");

-- CreateIndex
CREATE INDEX "Project_submittedByUserId_idx" ON "Project"("submittedByUserId");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectRating_projectId_idx" ON "ProjectRating"("projectId");

-- CreateIndex
CREATE INDEX "ProjectRating_userId_idx" ON "ProjectRating"("userId");

-- CreateIndex
CREATE INDEX "ProjectRating_projectId_status_idx" ON "ProjectRating"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRating_userId_projectId_key" ON "ProjectRating"("userId", "projectId");

-- CreateIndex
CREATE INDEX "Raffle_projectId_idx" ON "Raffle"("projectId");

-- CreateIndex
CREATE INDEX "Raffle_createdByUserId_idx" ON "Raffle"("createdByUserId");

-- CreateIndex
CREATE INDEX "Raffle_status_idx" ON "Raffle"("status");

-- CreateIndex
CREATE INDEX "Raffle_startsAt_idx" ON "Raffle"("startsAt");

-- CreateIndex
CREATE INDEX "Raffle_endsAt_idx" ON "Raffle"("endsAt");

-- CreateIndex
CREATE INDEX "RaffleEntry_raffleId_status_idx" ON "RaffleEntry"("raffleId", "status");

-- CreateIndex
CREATE INDEX "RaffleEntry_userId_idx" ON "RaffleEntry"("userId");

-- CreateIndex
CREATE INDEX "RaffleEntry_walletAddressId_idx" ON "RaffleEntry"("walletAddressId");

-- CreateIndex
CREATE INDEX "RaffleEntry_enteredAt_idx" ON "RaffleEntry"("enteredAt");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleEntry_raffleId_userId_key" ON "RaffleEntry"("raffleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleEntry_raffleId_walletAddressId_key" ON "RaffleEntry"("raffleId", "walletAddressId");

-- CreateIndex
CREATE INDEX "RaffleWinner_raffleId_idx" ON "RaffleWinner"("raffleId");

-- CreateIndex
CREATE INDEX "RaffleWinner_userId_idx" ON "RaffleWinner"("userId");

-- CreateIndex
CREATE INDEX "RaffleWinner_status_idx" ON "RaffleWinner"("status");

-- CreateIndex
CREATE INDEX "RaffleWinner_notificationStatus_idx" ON "RaffleWinner"("notificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleWinner_raffleId_selectionRank_key" ON "RaffleWinner"("raffleId", "selectionRank");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleWinner_raffleId_entryId_key" ON "RaffleWinner"("raffleId", "entryId");

-- CreateIndex
CREATE INDEX "RaffleEligibilitySnapshot_raffleId_idx" ON "RaffleEligibilitySnapshot"("raffleId");

-- CreateIndex
CREATE INDEX "RaffleEligibilitySnapshot_createdAt_idx" ON "RaffleEligibilitySnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "AlphaSubmission_submittedByUserId_idx" ON "AlphaSubmission"("submittedByUserId");

-- CreateIndex
CREATE INDEX "AlphaSubmission_projectId_idx" ON "AlphaSubmission"("projectId");

-- CreateIndex
CREATE INDEX "AlphaSubmission_status_idx" ON "AlphaSubmission"("status");

-- CreateIndex
CREATE INDEX "AlphaSubmission_reviewedByUserId_idx" ON "AlphaSubmission"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "AlphaSubmission_createdAt_idx" ON "AlphaSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "PointTransaction_userId_idx" ON "PointTransaction"("userId");

-- CreateIndex
CREATE INDEX "PointTransaction_type_idx" ON "PointTransaction"("type");

-- CreateIndex
CREATE INDEX "PointTransaction_alphaSubmissionId_idx" ON "PointTransaction"("alphaSubmissionId");

-- CreateIndex
CREATE INDEX "PointTransaction_raffleId_idx" ON "PointTransaction"("raffleId");

-- CreateIndex
CREATE INDEX "PointTransaction_createdAt_idx" ON "PointTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatChannel_slug_key" ON "ChatChannel"("slug");

-- CreateIndex
CREATE INDEX "ChatChannel_type_idx" ON "ChatChannel"("type");

-- CreateIndex
CREATE INDEX "ChatChannel_projectId_idx" ON "ChatChannel"("projectId");

-- CreateIndex
CREATE INDEX "ChatChannel_raffleId_idx" ON "ChatChannel"("raffleId");

-- CreateIndex
CREATE INDEX "ChatChannel_isActive_idx" ON "ChatChannel"("isActive");

-- CreateIndex
CREATE INDEX "ChatMessage_channelId_createdAt_idx" ON "ChatMessage"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_idx" ON "ChatMessage"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_moderationStatus_idx" ON "ChatMessage"("moderationStatus");

-- CreateIndex
CREATE INDEX "ChatMessage_discordMessageId_idx" ON "ChatMessage"("discordMessageId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletAddress" ADD CONSTRAINT "WalletAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRating" ADD CONSTRAINT "ProjectRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRating" ADD CONSTRAINT "ProjectRating_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_walletAddressId_fkey" FOREIGN KEY ("walletAddressId") REFERENCES "WalletAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleWinner" ADD CONSTRAINT "RaffleWinner_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleWinner" ADD CONSTRAINT "RaffleWinner_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "RaffleEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleWinner" ADD CONSTRAINT "RaffleWinner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleWinner" ADD CONSTRAINT "RaffleWinner_replacedByWinnerId_fkey" FOREIGN KEY ("replacedByWinnerId") REFERENCES "RaffleWinner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleEligibilitySnapshot" ADD CONSTRAINT "RaffleEligibilitySnapshot_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlphaSubmission" ADD CONSTRAINT "AlphaSubmission_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlphaSubmission" ADD CONSTRAINT "AlphaSubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlphaSubmission" ADD CONSTRAINT "AlphaSubmission_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_alphaSubmissionId_fkey" FOREIGN KEY ("alphaSubmissionId") REFERENCES "AlphaSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatChannel" ADD CONSTRAINT "ChatChannel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatChannel" ADD CONSTRAINT "ChatChannel_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_moderatedByUserId_fkey" FOREIGN KEY ("moderatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
