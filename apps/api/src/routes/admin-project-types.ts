import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

async function requireAdmin(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true, status: true, isAdminApproved: true } });
  if (!user || user.status === "BANNED" || !["ADMIN", "MODERATOR"].includes(user.role) || !user.isAdminApproved) return res.status(403).json({ success: false, message: "Admin access required" });
  next();
}

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;
async function ensureSchema() {
  if (schemaReady) return;
  schemaPromise ??= prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProjectClassification" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'NFT',
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProjectClassification_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "ProjectClassification_projectId_key" UNIQUE ("projectId"),
      CONSTRAINT "ProjectClassification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ProjectClassification_type_check" CHECK ("type" IN ('NFT', 'TOKEN', 'AIRDROP', 'OTHER'))
    );
    ALTER TABLE "ProjectClassification" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb;
    CREATE INDEX IF NOT EXISTS "ProjectClassification_type_idx" ON "ProjectClassification"("type");
    INSERT INTO "ProjectClassification" ("projectId", "type")
    SELECT p."id", CASE WHEN p."category"::text = 'NFT' THEN 'NFT' WHEN p."category"::text = 'TOKEN' THEN 'TOKEN' ELSE 'OTHER' END
    FROM "Project" p
    WHERE NOT EXISTS (SELECT 1 FROM "ProjectClassification" pc WHERE pc."projectId" = p."id");
  `).then(() => { schemaReady = true; }).catch((error) => { schemaPromise = null; throw error; });
  await schemaPromise;
}

router.get("/", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    await ensureSchema();
    const rows = await prisma.$queryRaw<Array<{ projectId: string; type: string; metadata: unknown }>>`SELECT "projectId", "type", "metadata" FROM "ProjectClassification"`;
    return res.json({ success: true, projectTypes: rows });
  } catch (error) {
    next(error);
  }
});

export default router;
