import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const now = new Date();
    const raffles = await prisma.raffle.findMany({
      where: {
        cancelledAt: null,
        projectId: { not: null },
        status: { in: ["SCHEDULED", "ACTIVE", "COMPLETED"] },
      },
      orderBy: [{ status: "asc" }, { startsAt: "desc" }],
      take: 100,
      include: {
        project: { select: { id: true, name: true, logoUrl: true, category: true } },
        _count: { select: { entries: true, winners: true, tasks: true } },
      },
    });

    const normalized = await Promise.all(raffles.map(async (raffle) => {
      let status = raffle.status;
      if (status === "SCHEDULED" && now >= raffle.startsAt && now < raffle.endsAt) {
        await prisma.raffle.update({ where: { id: raffle.id }, data: { status: "ACTIVE" } });
        status = "ACTIVE";
      } else if ((status === "SCHEDULED" || status === "ACTIVE") && now >= raffle.endsAt) {
        await prisma.raffle.update({ where: { id: raffle.id }, data: { status: "CLOSED" } });
        status = "CLOSED";
      }

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
    }));

    res.json({ success: true, raffles: normalized.filter((raffle) => ["SCHEDULED", "ACTIVE", "COMPLETED"].includes(raffle.status)) });
  } catch (error) {
    next(error);
  }
});

export default router;
