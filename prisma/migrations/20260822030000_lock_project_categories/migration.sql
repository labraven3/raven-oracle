-- Raven Oracle project catalog now supports only NFT, TOKEN, AIRDROP and OTHER.
-- Legacy categories are normalized to OTHER before tightening the enum.

UPDATE "Project"
SET "category" = 'OTHER'
WHERE "category"::text IN ('GAME', 'TOOL', 'DEFI', 'COMMUNITY');

DO $$
BEGIN
  CREATE TYPE "ProjectCategory_new" AS ENUM ('NFT', 'TOKEN', 'AIRDROP', 'OTHER');

  ALTER TABLE "Project"
    ALTER COLUMN "category" DROP DEFAULT,
    ALTER COLUMN "category" TYPE "ProjectCategory_new"
      USING (CASE
        WHEN "category"::text IN ('NFT', 'TOKEN', 'AIRDROP') THEN "category"::text
        ELSE 'OTHER'
      END)::"ProjectCategory_new";

  ALTER TABLE "Project"
    ALTER COLUMN "category" SET DEFAULT 'OTHER';

  DROP TYPE "ProjectCategory";
  ALTER TYPE "ProjectCategory_new" RENAME TO "ProjectCategory";
END $$;
