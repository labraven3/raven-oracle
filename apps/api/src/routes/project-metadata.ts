import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const projectType = z.enum(["NFT", "TOKEN", "AIRDROP", "OTHER"]);

const tokenMetadata = z.object({
  symbol: z.string().trim().min(1).max(20),
  contractAddress: z.string().trim().min(1).max(120),
  tokenStandard: z.string().trim().max(40).optional().or(z.literal("")),
  decimals: z.number().int().min(0).max(36).optional(),
  launchDate: z.string().datetime().optional().or(z.literal("")),
});

const airdropMetadata = z.object({
  snapshotDate: z.string().datetime().optional().or(z.literal("")),
  claimDate: z.string().datetime().optional().or(z.literal("")),
  allocation: z.string().trim().max(120).optional().or(z.literal("")),
  eligibility: z.string().trim().max(2000).optional().or(z.literal("")),
  claimUrl: z.string().url().optional().or(z.literal("")),
});

const otherMetadata = z.object({
  subtype: z.string().trim().max(80).optional().or(z.literal("")),
  externalUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().trim().max(3000).optional().or(z.literal("")),
});

const nftMetadata = z.object({
  collectionContractAddress: z.string().trim().max(120).optional().or(z.literal("")),
  supply: z.number().int().positive().optional(),
  standard: z.string().trim().max(40).optional().or(z.literal("")),
});

const metadataSchema = z.object({
  projectType: projectType,
  metadata: z.record(z.string(), z.unknown()).default({}),
});

let ready = false;
let readyPromise: Promise<void> | null = null;

async function ensureSchema() {
  if (ready) return;
  readyPromise ??= prisma.$executeRawUnsafe(`
    ALTER TABLE "ProjectClassification" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb;
  `).then(() => { ready = true; }).catch((error) => { readyPromise = null; throw error; });
  await readyPromise;
}

async function getClassification(projectId: string) {
  return prisma.$queryRaw<Array<{ type: string; metadata: unknown }>>`
    SELECT "type", "metadata" FROM "ProjectClassification" WHERE "projectId" = ${projectId}::uuid LIMIT 1
  `;
}

function validateMetadata(type: z.infer<typeof projectType>, metadata: Record<string, unknown>) {
  if (type === "TOKEN") return tokenMetadata.parse(metadata);
  if (type === "AIRDROP") return airdropMetadata.parse(metadata);
  if (type === "OTHER") return otherMetadata.parse(metadata);
  return nftMetadata.parse(metadata);
}

router.get("/:id", async (req, res, next) => {
  try {
    await ensureSchema();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ success: false, message: "Invalid project ID" });
    const rows = await getClassification(id);
    if (!rows[0]) return res.status(404).json({ success: false, message: "Project type data not found" });
    return res.json({ success: true, projectType: rows[0].type, metadata: rows[0].metadata ?? {} });
  } catch (error) { next(error); }
});

router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ success: false, message: "Invalid project ID" });
    const project = await prisma.project.findUnique({ where: { id }, select: { id: true, submittedByUserId: true, deletedAt: true } });
    if (!project || project.deletedAt) return res.status(404).json({ success: false, message: "Project not found" });
    if (project.submittedByUserId !== req.userId) return res.status(403).json({ success: false, message: "You do not own this project" });
    const parsed = metadataSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid project metadata", errors: parsed.error.issues });
    let normalized: Record<string, unknown>;
    try { normalized = validateMetadata(parsed.data.projectType, parsed.data.metadata) as Record<string, unknown>; }
    catch (error) { return res.status(400).json({ success: false, message: "Invalid type-specific project data", errors: error instanceof z.ZodError ? error.issues : [] }); }
    await prisma.$executeRaw`
      INSERT INTO "ProjectClassification" ("projectId", "type", "metadata")
      VALUES (${id}::uuid, ${parsed.data.projectType}, ${JSON.stringify(normalized)}::jsonb)
      ON CONFLICT ("projectId") DO UPDATE SET "type" = EXCLUDED."type", "metadata" = EXCLUDED."metadata", "updatedAt" = CURRENT_TIMESTAMP
    `;
    return res.json({ success: true, projectType: parsed.data.projectType, metadata: normalized });
  } catch (error) { next(error); }
});

export default router;
