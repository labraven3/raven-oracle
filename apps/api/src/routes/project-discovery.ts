import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getProjectChains } from "../services/chain-config.service.js";

const router = Router();
const PROJECT_TYPES = ["NFT", "TOKEN", "AIRDROP", "OTHER"] as const;

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
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? "60"), 10) || 60, 1), 100);

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

    const counts = Object.fromEntries(
      PROJECT_TYPES.map((projectType) => [
        projectType,
        enriched.filter((project) => project.projectType === projectType).length,
      ]),
    );

    return res.json({
      success: true,
      projects: filtered,
      total: filtered.length,
      counts: { ALL: enriched.length, ...counts },
      filters: { projectType: type ?? "ALL", chain: chain ?? "ALL", search },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
