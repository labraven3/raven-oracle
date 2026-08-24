import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const now = new Date();

    const [projects, raffles] = await Promise.all([
      prisma.project.findMany({
        where: { deletedAt: null, status: { in: ["APPROVED", "SUBMITTED"] }, category: "NFT" },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          logoUrl: true,
          bannerUrl: true,
          category: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.raffle.findMany({
        where: {
          cancelledAt: null,
          projectId: { not: null },
          status: { in: ["SCHEDULED", "ACTIVE", "COMPLETED"] },
          project: { status: { in: ["APPROVED", "SUBMITTED"] }, category: "NFT", deletedAt: null },
        },
        orderBy: [{ status: "asc" }, { startsAt: "desc" }],
        take: 100,
        include: {
          project: { select: { id: true, name: true, logoUrl: true, status: true } },
          _count: { select: { entries: true, winners: true, tasks: true } },
        },
      }),
    ]);

    const normalizedRaffles = raffles.map((raffle) => {
      let status = raffle.status;
      if (status === "SCHEDULED" && now >= raffle.startsAt && now < raffle.endsAt) status = "ACTIVE";
      if ((status === "SCHEDULED" || status === "ACTIVE") && now >= raffle.endsAt) status = "CLOSED";
      return {
        id: raffle.id,
        title: raffle.title,
        description: raffle.description,
        prizeName: raffle.prizeName,
        prizeQuantity: raffle.prizeQuantity,
        startsAt: raffle.startsAt,
        endsAt: raffle.endsAt,
        status,
        winnerCount: raffle.winnerCount,
        project: raffle.project,
        _count: raffle._count,
      };
    }).filter((raffle) => ["SCHEDULED", "ACTIVE", "COMPLETED"].includes(raffle.status));

    res.json({
      success: true,
      projects,
      raffles: normalizedRaffles,
      stats: {
        projects: projects.length,
        liveRaffles: normalizedRaffles.filter((raffle) => raffle.status === "ACTIVE").length,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
