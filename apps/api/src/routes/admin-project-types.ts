import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const projectType = z.enum(["NFT", "TOKEN", "AIRDROP", "OTHER"]);

const metadataByType = {
  TOKEN: z.object({
    symbol: z.string().trim().min(1).max(20),
    contractAddress: z.string().trim().min(1).max(120),
    tokenStandard: z.string().trim().max(40).optional().or(z.literal("")),
    decimals: z.number().int().min(0).max(36).optional(),
    launchDate: z.string().datetime().optional().or(z.literal("")),
  }),
  AIRDROP: z.object({
    snapshotDate: z.string().datetime().optional().or(z.literal("")),
    claimDate: z.string().datetime().optional().or(z.literal("")),
    allocation: z.string().trim().max(120).optional().or(z.literal("")),
    eligibility: z.string().trim().max(2000).optional().or(z.literal("")),
    claimUrl: z.string().url().optional().or(z.literal("")),
  }),
  OTHER: z.object({
    subtype: z.string().trim().max(80).optional().or(z.literal("")),
    externalUrl: z.string().url().optional().or(z.literal("")),
    notes: z.string().trim().max(3000).optional().or(z.literal("")),
  }),
  NFT: z.object({
    collectionContractAddress: z.string().trim().max(120).optional().or(z.literal("")),
    supply: z.number().int().positive().optional(),
    standard: z.string().trim().max(40).optional().or(z.literal("")),
  }),
} as const;

function requireAdmin(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
  prisma.user.findUnique({ where: { id: req.userId }, select: { role: true, status: true, isAdminApproved: true } }).then((user) => {
    if (!user || user.status === "BANNED" || !["ADMIN", "MODERATOR"].includes(user.role) || !user.isAdminApproved) return res.status(403).json({ success: false, message: "Admin access required" });
    next();
  }).catch(next);
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
    const rows = await prisma.$queryRaw<Array<{ projectId: string; type: string; metadata: unknown }>>`
      SELECT "projectId", "type", "metadata" FROM "ProjectClassification" ORDER BY "updatedAt" DESC
    `;
    return res.json({ success: true, projectTypes: rows });
  } catch (error) { next(error); }
});

router.get("/:projectId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await ensureSchema();
    const id = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
    if (!id) return res.status(400).json({ success: false, message: "Invalid project ID" });
    const rows = await prisma.$queryRaw<Array<{ projectId: string; type: string; metadata: unknown }>>`
      SELECT "projectId", "type", "metadata" FROM "ProjectClassification" WHERE "projectId" = ${id}::uuid LIMIT 1
    `;
    if (!rows[0]) return res.status(404).json({ success: false, message: "Project type data not found" });
    return res.json({ success: true, projectType: rows[0].type, metadata: rows[0].metadata ?? {} });
  } catch (error) { next(error); }
});

router.put("/:projectId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await ensureSchema();
    const id = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
    if (!id) return res.status(400).json({ success: false, message: "Invalid project ID" });
    const parsed = z.object({ projectType, metadata: z.record(z.string(), z.unknown()).default({}) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid project metadata", errors: parsed.error.issues });
    const validator = metadataByType[parsed.data.projectType];
    const normalized = validator.safeParse(parsed.data.metadata);
    if (!normalized.success) return res.status(400).json({ success: false, message: "Invalid type-specific project data", errors: normalized.error.issues });
    const project = await prisma.project.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
    if (!project || project.deletedAt) return res.status(404).json({ success: false, message: "Project not found" });
    await prisma.$executeRaw`
      INSERT INTO "ProjectClassification" ("projectId", "type", "metadata")
      VALUES (${id}::uuid, ${parsed.data.projectType}, ${JSON.stringify(normalized.data)}::jsonb)
      ON CONFLICT ("projectId") DO UPDATE SET "type" = EXCLUDED."type", "metadata" = EXCLUDED."metadata", "updatedAt" = CURRENT_TIMESTAMP
    `;
    return res.json({ success: true, projectType: parsed.data.projectType, metadata: normalized.data });
  } catch (error) { next(error); }
});

export default router;
