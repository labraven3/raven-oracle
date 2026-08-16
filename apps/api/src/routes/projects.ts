import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Keep API validation aligned with prisma/schema.prisma ProjectCategory.
const category = z.enum([
  "NFT",
  "TOKEN",
  "GAME",
  "TOOL",
  "DEFI",
  "COMMUNITY",
  "OTHER",
]);

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5000).optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  xUrl: z.string().url().optional().or(z.literal("")),
  discordUrl: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  category: category.default("OTHER"),
});

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "project";
}

async function uniqueSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let i = 2;
  while (await prisma.project.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

router.get("/", async (_req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        websiteUrl: true,
        xUrl: true,
        discordUrl: true,
        logoUrl: true,
        category: true,
        status: true,
        createdAt: true,
      },
    });
    return res.json({ success: true, projects });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid project data", errors: z.treeifyError(parsed.error) });

    const slug = await uniqueSlug(parsed.data.name);
    const project = await prisma.project.create({
      data: {
        name: parsed.data.name,
        slug,
        description: parsed.data.description || null,
        websiteUrl: parsed.data.websiteUrl || null,
        xUrl: parsed.data.xUrl || null,
        discordUrl: parsed.data.discordUrl || null,
        logoUrl: parsed.data.logoUrl || null,
        category: parsed.data.category,
        status: "SUBMITTED",
        submittedByUserId: req.userId,
      },
    });

    return res.status(201).json({ success: true, project });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        raffles: {
          where: { cancelledAt: null },
          orderBy: { startsAt: "desc" },
          take: 50,
        },
      },
    });
    if (!project || project.deletedAt) return res.status(404).json({ success: false, message: "Project not found" });
    return res.json({ success: true, project });
  } catch (error) {
    next(error);
  }
});

export default router;
