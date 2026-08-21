import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../middleware/auth.js";

const router = Router();

// Admins can review/manage raffles, but raffles are created from the owning project dashboard.
router.get("/raffles", requireAdminAuth, async (_req, res, next) => {
  try {
    const raffles = await prisma.raffle.findMany({
      orderBy: { startsAt: "desc" },
      take: 100,
      include: {
        project: { select: { id: true, name: true, logoUrl: true, category: true } },
        createdBy: { select: { email: true, username: true } },
        _count: { select: { entries: true, winners: true, tasks: true } },
      },
    });
    res.json({ success: true, raffles });
  } catch (error) {
    next(error);
  }
});

export default router;
