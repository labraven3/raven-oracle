import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../middleware/auth.js";
import { getProjectChains } from "../services/chain-config.service.js";

const router = Router();

router.use(requireAdminAuth);

router.get("/", async (_req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        name: true,
        status: true,
        category: true,
        createdAt: true,
      },
    });

    const chains = await getProjectChains(projects.map((project) => project.id));
    const chainByProject = new Map(chains.map((row) => [row.projectId, row.chainName]));

    return res.json({
      success: true,
      projects: projects.map((project) => ({
        ...project,
        chain: chainByProject.get(project.id) ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
