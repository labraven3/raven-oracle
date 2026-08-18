import { prisma } from "../lib/prisma.js";
import type { AuditAction, Prisma } from "@prisma/client";

/**
 * Audit Log Service
 * 
 * Records administrative and moderation actions for accountability
 * and security tracking.
 */

interface CreateAuditLogParams {
  actorUserId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  riskContext?: Record<string, unknown>;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(
  params: CreateAuditLogParams
): Promise<void> {
  const data: {
    actorUserId: string | null;
    action: AuditAction;
    entityType: string;
    entityId: string;
    summary: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
    riskContext?: Prisma.InputJsonValue;
  } = {
    actorUserId: params.actorUserId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    summary: params.summary,
  };

  if (params.before) {
    data.before = params.before as Prisma.InputJsonValue;
  }
  if (params.after) {
    data.after = params.after as Prisma.InputJsonValue;
  }
  if (params.metadata) {
    data.metadata = params.metadata as Prisma.InputJsonValue;
  }
  if (params.riskContext) {
    data.riskContext = params.riskContext as Prisma.InputJsonValue;
  }

  await prisma.auditLog.create({ data });
}

/**
 * Log alpha submission moderation action
 */
export async function logAlphaModeration(
  actorUserId: string,
  submissionId: string,
  action: "ALPHA_VERIFIED" | "ALPHA_REJECTED",
  before: { status: string; pointsAwarded: number | null },
  after: {
    status: string;
    pointsAwarded: number | null;
    rejectionReason?: string | null;
  },
  metadata?: Record<string, unknown>
): Promise<void> {
  await createAuditLog({
    actorUserId,
    action,
    entityType: "AlphaSubmission",
    entityId: submissionId,
    summary:
      action === "ALPHA_VERIFIED"
        ? `Verified alpha submission (${after.pointsAwarded || 0} points awarded)`
        : `Rejected alpha submission: ${after.rejectionReason || "No reason provided"}`,
    before: {
      status: before.status,
      pointsAwarded: before.pointsAwarded,
    },
    after: {
      status: after.status,
      pointsAwarded: after.pointsAwarded,
      rejectionReason: after.rejectionReason,
    },
    ...(metadata ? { metadata } : {}),
  });
}

/**
 * Log points awarded/deducted
 */
export async function logPointsTransaction(
  actorUserId: string | null,
  userId: string,
  amount: number,
  action: "POINTS_AWARDED" | "POINTS_DEDUCTED",
  reason: string,
  relatedEntityType?: string,
  relatedEntityId?: string
): Promise<void> {
  await createAuditLog({
    actorUserId,
    action,
    entityType: "PointTransaction",
    entityId: userId,
    summary: `${amount > 0 ? "+" : ""}${amount} points: ${reason}`,
    metadata: {
      userId,
      amount,
      relatedEntityType: relatedEntityType || undefined,
      relatedEntityId: relatedEntityId || undefined,
    },
  });
}

/**
 * Log project moderation action
 */
export async function logProjectModeration(
  actorUserId: string,
  projectId: string,
  action: "PROJECT_APPROVED" | "PROJECT_REJECTED",
  before: { status: string },
  after: { status: string; rejectionReason?: string | null }
): Promise<void> {
  await createAuditLog({
    actorUserId,
    action,
    entityType: "Project",
    entityId: projectId,
    summary:
      action === "PROJECT_APPROVED"
        ? "Project approved"
        : `Project rejected: ${after.rejectionReason || "No reason provided"}`,
    before: {
      status: before.status,
    },
    after: {
      status: after.status,
      rejectionReason: after.rejectionReason,
    },
  });
}

/**
 * Log raffle winner selection
 */
export async function logRaffleWinnerSelection(
  actorUserId: string,
  raffleId: string,
  winnerCount: number,
  eligibleEntryCount: number,
  algorithmVersion: string
): Promise<void> {
  await createAuditLog({
    actorUserId,
    action: "RAFFLE_WINNER_SELECTED",
    entityType: "Raffle",
    entityId: raffleId,
    summary: `Drew ${winnerCount} winner(s) from ${eligibleEntryCount} eligible entries`,
    metadata: {
      winnerCount,
      eligibleEntryCount,
      algorithmVersion,
    },
  });
}

/**
 * Log user suspension/ban
 */
export async function logUserAction(
  actorUserId: string,
  userId: string,
  action: "USER_SUSPENDED" | "USER_BANNED",
  reason: string,
  before: { status: string },
  after: { status: string }
): Promise<void> {
  await createAuditLog({
    actorUserId,
    action,
    entityType: "User",
    entityId: userId,
    summary: `User ${action === "USER_SUSPENDED" ? "suspended" : "banned"}: ${reason}`,
    before: {
      status: before.status,
    },
    after: {
      status: after.status,
    },
  });
}

/**
 * Log chat message moderation
 */
export async function logChatModeration(
  actorUserId: string,
  messageId: string,
  action: "CHAT_MESSAGE_MODERATED",
  before: { moderationStatus: string },
  after: { moderationStatus: string },
  reason?: string
): Promise<void> {
  await createAuditLog({
    actorUserId,
    action,
    entityType: "ChatMessage",
    entityId: messageId,
    summary: `Message moderated: ${after.moderationStatus}${reason ? ` - ${reason}` : ""}`,
    before: {
      moderationStatus: before.moderationStatus,
    },
    after: {
      moderationStatus: after.moderationStatus,
    },
    ...(reason ? { metadata: { reason } } : {}),
  });
}
