import { Router } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { chainExists, setProjectChain } from "../services/chain-config.service.js";

const router = Router();
const projectType = z.enum(["NFT", "TOKEN", "AIRDROP", "OTHER"]);
const imageDataUrl = z.string().regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).max(1_500_000);
const tokenMetadata = z.object({ symbol: z.string().trim().min(1).max(20), contractAddress: z.string().trim().min(1).max(120), tokenStandard: z.string().trim().max(40).optional().or(z.literal("")), decimals: z.number().int().min(0).max(36).optional(), totalSupply: z.string().trim().max(120).optional().or(z.literal("")), explorerUrl: z.string().url().optional().or(z.literal("")), launchDate: z.string().datetime().optional().or(z.literal("")) });
const airdropMetadata = z.object({ snapshotDate: z.string().datetime().optional().or(z.literal("")), claimDate: z.string().datetime().optional().or(z.literal("")), claimStatus: z.enum(["UPCOMING", "LIVE", "ENDED"]).optional(), allocation: z.string().trim().max(120).optional().or(z.literal("")), eligibility: z.string().trim().max(2000).optional().or(z.literal("")), claimUrl: z.string().url().optional().or(z.literal("")) });
const nftMetadata = z.object({ collectionContractAddress: z.string().trim().max(120).optional().or(z.literal("")), supply: z.number().int().positive().optional(), standard: z.string().trim().max(40).optional().or(z.literal("")) });
const otherMetadata = z.object({ subtype: z.string().trim().max(80).optional().or(z.literal("")), externalUrl: z.string().url().optional().or(z.literal("")), notes: z.string().trim().max(3000).optional().or(z.literal("")) });
const metadata = z.record(z.string(), z.unknown()).default({});
const onboardingSchema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(5000), websiteUrl: z.string().url().optional().or(z.literal("")), xUrl: z.string().url().optional().or(z.literal("")), discordUrl: z.string().url().optional().or(z.literal("")), logoUrl: imageDataUrl, bannerUrl: imageDataUrl, projectType, chain: z.string().trim().min(1).max(80), metadata });

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "project"; }
async function uniqueSlug(name: string) { const base = slugify(name); let slug = base; let i = 2; while (await prisma.project.findUnique({ where: { slug } })) slug = `${base}-${i++}`; return slug; }
function validateMetadata(type: z.infer<typeof projectType>, value: Record<string, unknown>) { if (type === "TOKEN") return tokenMetadata.parse(value); if (type === "AIRDROP") return airdropMetadata.parse(value); if (type === "NFT") return nftMetadata.parse(value); return otherMetadata.parse(value); }
function publicCategoryForType(type: z.infer<typeof projectType>) { return type === "NFT" ? "NFT" : type === "TOKEN" ? "TOKEN" : "OTHER"; }

router.post("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid project onboarding data", errors: parsed.error.issues });
    if (!(await chainExists(parsed.data.chain))) return res.status(400).json({ success: false, message: "Selected chain is not active" });
    try { parsed.data.metadata = validateMetadata(parsed.data.projectType, parsed.data.metadata) as Record<string, unknown>; }
    catch (error) { return res.status(400).json({ success: false, message: "Invalid type-specific project data", errors: error instanceof z.ZodError ? error.issues : [] }); }
    const pendingCount = await prisma.project.count({ where: { submittedByUserId: req.userId, status: "SUBMITTED", deletedAt: null } });
    if (pendingCount >= 5) return res.status(429).json({ success: false, message: "You have too many pending project submissions. Please wait for them to be reviewed." });
    const slug = await uniqueSlug(parsed.data.name);
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({ data: { name: parsed.data.name, slug, description: parsed.data.description, websiteUrl: parsed.data.websiteUrl || null, xUrl: parsed.data.xUrl || null, discordUrl: parsed.data.discordUrl || null, logoUrl: parsed.data.logoUrl, bannerUrl: parsed.data.bannerUrl || null, category: publicCategoryForType(parsed.data.projectType), status: "SUBMITTED", submittedByUserId: req.userId! } });
      await setProjectChain(created.id, parsed.data.chain);
      await tx.$executeRaw`
        INSERT INTO "ProjectClassification" ("projectId", "type", "metadata")
        VALUES (${created.id}::uuid, ${parsed.data.projectType}, ${JSON.stringify(parsed.data.metadata)}::jsonb)
        ON CONFLICT ("projectId") DO UPDATE SET "type" = EXCLUDED."type", "metadata" = EXCLUDED."metadata", "updatedAt" = CURRENT_TIMESTAMP
      `;
      return created;
    });
    return res.status(201).json({ success: true, project: { ...project, projectType: parsed.data.projectType, chain: parsed.data.chain } });
  } catch (error) { next(error); }
});

export default router;
