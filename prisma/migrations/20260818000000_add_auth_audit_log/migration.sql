-- CreateEnum
CREATE TYPE "AuthAuditEvent" AS ENUM (
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'REGISTER_SUCCESS',
  'EMAIL_VERIFICATION_SUCCESS',
  'EMAIL_VERIFICATION_FAILED',
  'OTP_REQUEST',
  'OTP_VERIFICATION_SUCCESS',
  'OTP_VERIFICATION_FAILED',
  'LOGOUT',
  'OAUTH_LOGIN_SUCCESS',
  'OAUTH_LOGIN_FAILED'
);

-- CreateTable
CREATE TABLE "AuthAuditLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "event" "AuthAuditEvent" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "provider" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthAuditLog_userId_idx" ON "AuthAuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuthAuditLog_event_idx" ON "AuthAuditLog"("event");

-- CreateIndex
CREATE INDEX "AuthAuditLog_createdAt_idx" ON "AuthAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuthAuditLog_userId_event_idx" ON "AuthAuditLog"("userId", "event");

-- AddForeignKey
ALTER TABLE "AuthAuditLog" ADD CONSTRAINT "AuthAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
