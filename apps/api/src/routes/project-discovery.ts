import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getProjectChains } from "../services/chain-config.service.js";

const router = Router();
const PROJECT_TYPES = ["NFT", "TOKEN", "AIRDROP", "OTHER"] as const;
const CACHE_MS = 10_000;
const cache = new Map<string, { expiresAt: number; payload: unknown }>();

type ProjectType = (typeof PROJECT_TYPES)[number];

function parseType(value: unknown): ProjectType | undefined {
  return typeof value === "string" && PROJECT_TYPES.includes(value as ProjectType)
    ? (value as ProjectType)
    : undefined;
}

async function getProjectTypes(projectIds: string[]) {
  if (projectIds.length === 0) return new Map<string, string>();
  const rows = await prisma.$queryRaw<Array<{ projectId: string; type: string }>>`
    SELECT "projectId", "type"
    FROM "ProjectClassification"
    WHERE "projectId" IN (${Prisma.join(projectIds.map((id) => Prisma.sql`${id}::uuid`))})
  `;
  return new Map(rows.map((row) => [row.projectId, row.type]));
}

router.get("/", async (req, res, next) => {
  try {
    const type = parseType(req.query.projectType);
    const chain = typeof req.query.chain === "string" && req.query.chain !== "ALL" ? req.query.chain.trim() : undefined;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? "24"), 10) || 24, 1), 60);
    const cacheKey = JSON.stringify({ type: type ?? "ALL", chain: chain ?? "ALL", search, limit });
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=15");
      return res.json(hit.payload);
    }

    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      status: { in: ["APPROVED", "SUBMITTED"] },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        websiteUrl: true,
        xUrl: true,
        discordUrl: true,
        logoUrl: true,
        bannerUrl: true,
        category: true,
        status: true,
        createdAt: true,
      },
    });

    const [chains, typeByProject] = await Promise.all([
      getProjectChains(projects.map((project) => project.id)),
      getProjectTypes(projects.map((project) => project.id)),
    ]);
    const chainByProject = new Map(chains.map((item) => [item.projectId, item.chainName]));

    const enriched = projects.map((project) => ({
      ...project,
      projectType: typeByProject.get(project.id) ?? "NFT",
      chain: chainByProject.get(project.id) ?? null,
    }));

    const filtered = enriched
      .filter((project) => !type || project.projectType === type)
      .filter((project) => !chain || project.chain === chain)
      .slice(0, limit);

    const payload = {
      success: true,
      projects: filtered,
      total: filtered.length,
      counts: { ALL: enriched.length, ...Object.fromEntries(PROJECT_TYPES.map((projectType) => [projectType, enriched.filter((project) => project.projectType === projectType).length])) },
      filters: { projectType: type ?? "ALL", chain: chain ?? "ALL", search },
    };

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, payload });
    if (cache.size > 50) {
      for (const [key, value] of cache) if (value.expiresAt <= Date.now()) cache.delete(key);
    }

    res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=15");
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

export default router;
