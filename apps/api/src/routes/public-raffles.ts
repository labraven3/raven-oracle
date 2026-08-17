import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

/**
 * GET /api/raffles/public
 * Public discovery feed. Draft/cancelled raffles are never exposed.
 */
router.get("/", async (_req, res, next) => {
  try {
    const now = new Date();
    const raffles = await prisma.raffle.findMany({
      where: {
        cancelledAt: null,
        status: { in: ["SCHEDULED", "ACTIVE", "COMPLETED"] },
      },
      orderBy: [{ status: "asc" }, { startsAt: "desc" }],
      take: 100,
      select: {
        id: true,
        title: true,
        description: true,
        prizeName: true,
        prizeQuantity: true,
        startsAt: true,
        endsAt: true,
        status: true,
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
      return { ...raffle, status };
    }));

    res.json({ success: true, raffles: normalized.filter((raffle) => ["SCHEDULED", "ACTIVE", "COMPLETED"].includes(raffle.status)) });
  } catch (error) {
    next(error);
  }
});

export default router;
