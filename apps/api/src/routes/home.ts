import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();
const CACHE_MS = 15_000;
let cache: { expiresAt: number; payload: unknown } | null = null;

router.get("/", async (_req, res, next) => {
  try {
    if (cache && cache.expiresAt > Date.now()) {
      res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=15");
      return res.json(cache.payload);
    }

    const now = new Date();
    const [projects, raffles] = await Promise.all([
      prisma.project.findMany({
        where: { deletedAt: null, status: { in: ["APPROVED", "SUBMITTED"] }, category: "NFT" },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, name: true, slug: true, description: true, logoUrl: true, bannerUrl: true, category: true, status: true, createdAt: true },
      }),
      prisma.raffle.findMany({
        where: {
          cancelledAt: null,
          projectId: { not: null },
          status: { in: ["SCHEDULED", "ACTIVE"] },
          project: { status: { in: ["APPROVED", "SUBMITTED"] }, category: "NFT", deletedAt: null },
        },
        orderBy: [{ status: "asc" }, { startsAt: "desc" }],
        take: 30,
        select: {
          id: true, title: true, description: true, prizeName: true, prizeQuantity: true,
          startsAt: true, endsAt: true, status: true, winnerCount: true,
          project: { select: { id: true, name: true, logoUrl: true } },
          _count: { select: { entries: true, winners: true, tasks: true } },
        },
      }),
    ]);

    const normalizedRaffles = raffles.map((raffle) => {
      let status = raffle.status;
      if (status === "SCHEDULED" && now >= raffle.startsAt && now < raffle.endsAt) status = "ACTIVE";
      if ((status === "SCHEDULED" || status === "ACTIVE") && now >= raffle.endsAt) status = "CLOSED";
      return { ...raffle, status };
    }).filter((raffle) => raffle.status === "SCHEDULED" || raffle.status === "ACTIVE");

    const payload = {
      success: true,
      projects,
      raffles: normalizedRaffles,
      stats: { projects: projects.length, liveRaffles: normalizedRaffles.filter((raffle) => raffle.status === "ACTIVE").length },
    };

    cache = { expiresAt: Date.now() + CACHE_MS, payload };
    res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=15");
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

export default router;
