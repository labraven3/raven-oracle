CREATE TABLE IF NOT EXISTS "ProjectClassification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'NFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectClassification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectClassification_projectId_key" UNIQUE ("projectId"),
  CONSTRAINT "ProjectClassification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectClassification_type_check" CHECK ("type" IN ('NFT', 'TOKEN', 'AIRDROP', 'OTHER'))
);

CREATE INDEX IF NOT EXISTS "ProjectClassification_type_idx" ON "ProjectClassification"("type");

INSERT INTO "ProjectClassification" ("projectId", "type")
SELECT p."id",
       CASE
         WHEN p."category"::text = 'NFT' THEN 'NFT'
         WHEN p."category"::text = 'TOKEN' THEN 'TOKEN'
         ELSE 'OTHER'
       END
FROM "Project" p
WHERE NOT EXISTS (
  SELECT 1 FROM "ProjectClassification" pc WHERE pc."projectId" = p."id"
);
