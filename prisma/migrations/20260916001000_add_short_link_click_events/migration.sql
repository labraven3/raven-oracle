CREATE TABLE "RaffleShortLinkClick" (
  "id" UUID NOT NULL,
  "shortLinkId" UUID NOT NULL,
  "referrer" TEXT,
  "userAgent" TEXT,
  "deviceType" VARCHAR(16),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RaffleShortLinkClick_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RaffleShortLinkClick_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "RaffleShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "RaffleShortLinkClick_shortLinkId_createdAt_idx" ON "RaffleShortLinkClick"("shortLinkId", "createdAt");
CREATE INDEX "RaffleShortLinkClick_createdAt_idx" ON "RaffleShortLinkClick"("createdAt");
