-- Add admin whitelist fields to User table
ALTER TABLE "User" ADD COLUMN "isAdminApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "adminApprovedAt" TIMESTAMP(3);

-- Create index for admin whitelist queries
CREATE INDEX "User_isAdminApproved_idx" ON "User"("isAdminApproved");
