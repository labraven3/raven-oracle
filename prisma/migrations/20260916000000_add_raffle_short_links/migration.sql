-- Production raffle short links. Destinations are always Raven Oracle raffles.
CREATE TABLE "RaffleShortLink" (
  "id" UUID NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "raffleId" UUID NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "uniqueClickCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastClickedAt" TIMESTAMP(3),
  CONSTRAINT "RaffleShortLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RaffleShortLink_slug_key" UNIQUE ("slug"),
  CONSTRAINT "RaffleShortLink_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RaffleShortLink_raffleId_idx" ON "RaffleShortLink"("raffleId");
CREATE INDEX "RaffleShortLink_active_idx" ON "RaffleShortLink"("active");
CREATE INDEX "RaffleShortLink_lastClickedAt_idx" ON "RaffleShortLink"("lastClickedAt");

-- One privacy-preserving fingerprint per link. No raw IP is persisted.
CREATE TABLE "RaffleShortLinkVisitor" (
  "id" UUID NOT NULL,
  "shortLinkId" UUID NOT NULL,
  "visitorHash" VARCHAR(64) NOT NULL,
  "visitedOn" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RaffleShortLinkVisitor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RaffleShortLinkVisitor_shortLinkId_visitorHash_key" UNIQUE ("shortLinkId", "visitorHash"),
  CONSTRAINT "RaffleShortLinkVisitor_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "RaffleShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RaffleShortLinkVisitor_shortLinkId_idx" ON "RaffleShortLinkVisitor"("shortLinkId");
