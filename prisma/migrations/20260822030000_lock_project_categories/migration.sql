-- Raven Oracle project catalog now uses project classification for NFT, TOKEN,
-- AIRDROP and OTHER. The legacy Project.category column is retained only as a
-- compatibility field and is limited to NFT, TOKEN and OTHER.

UPDATE "Project"
SET "category" = 'OTHER'
WHERE "category"::text IN ('GAME', 'TOOL', 'DEFI', 'COMMUNITY');

DO $$
BEGIN
  CREATE TYPE "ProjectCategory_new" AS ENUM ('NFT', 'TOKEN', 'OTHER');

  ALTER TABLE "Project"
    ALTER COLUMN "category" DROP DEFAULT,
    ALTER COLUMN "category" TYPE "ProjectCategory_new"
      USING (CASE
        WHEN "category"::text IN ('NFT', 'TOKEN') THEN "category"::text
        ELSE 'OTHER'
      END)::"ProjectCategory_new";

  ALTER TABLE "Project"
    ALTER COLUMN "category" SET DEFAULT 'OTHER';

  DROP TYPE "ProjectCategory";
  ALTER TYPE "ProjectCategory_new" RENAME TO "ProjectCategory";
END $$;
