import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { drawRaffle } from "../services/raffle-draw.service.js";
import { notifyWinner, claimWinner } from "../services/raffle-winner.service.js";

const router = Router();

function getRaffleId(req: Request, res: Response): string | null {
  const id = req.params.id;

  if (typeof id !== "string") {
    res.status(400).json({
      success: false,
      message: "Invalid raffle ID",
    });
    return null;
  }

  return id;
}

const createRaffleSchema = z.object({
  projectId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  prizeName: z.string().trim().min(1).max(200),
  prizeDescription: z.string().trim().max(5000).optional(),
  prizeQuantity: z.number().int().positive().default(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  entryRules: z.record(z.string(), z.unknown()).default({}),
  maxEntriesPerUser: z.number().int().positive().default(1),
  winnerCount: z.number().int().positive().default(1),
  fairnessAlgorithmVersion: z.string().trim().max(100).optional(),
});

const listSchema = z.object({
  status: z.string().optional(),
});

function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

/**
 * Create a raffle.
 */
router.post(
  "/",
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const parsed = createRaffleSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid raffle data",
        errors: z.treeifyError(parsed.error),
      });
      return;
    }

    const data = parsed.data;
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);

    if (endsAt <= startsAt) {
      res.status(400).json({
        success: false,
        message: "endsAt must be after startsAt",
      });
      return;
    }

    if (data.winnerCount > data.prizeQuantity) {
      res.status(400).json({
        success: false,
        message: "winnerCount cannot exceed prizeQuantity",
      });
      return;
    }

    if (data.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: "Project not found",
        });
        return;
      }
    }

    const raffle = await prisma.raffle.create({
      data: {
        projectId: data.projectId ?? null,
        createdByUserId: req.userId,
        title: data.title,
        description: data.description ?? null,
        prizeName: data.prizeName,
        prizeDescription: data.prizeDescription ?? null,
        prizeQuantity: data.prizeQuantity,
        startsAt,
        endsAt,
        entryRules: data.entryRules as Prisma.InputJsonValue,
        maxEntriesPerUser: data.maxEntriesPerUser,
        winnerCount: data.winnerCount,
        fairnessAlgorithmVersion: data.fairnessAlgorithmVersion ?? null,
      },
    });

    res.status(201).json({
      success: true,
      raffle,
    });
  })
);

/**
 * List raffles.
 *
 * By default returns non-cancelled raffles.
 */
router.get(
  "/",
  asyncRoute(async (req, res) => {
    const parsed = listSchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid query",
      });
      return;
    }

    const raffles = await prisma.raffle.findMany({
      where: parsed.data.status
        ? {
            status: parsed.data.status as never,
          }
        : {
            cancelledAt: null,
          },
      orderBy: {
        startsAt: "desc",
      },
      take: 100,
    });

    res.json({
      success: true,
      raffles,
    });
  })
);

/**
 * Get a raffle.
 */
router.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const raffleId = getRaffleId(req, res);
    if (!raffleId) return;

    const raffle = await prisma.raffle.findUnique({
      where: {
        id: raffleId,
      },
      include: {
        project: true,
      },
    });

    if (!raffle) {
      res.status(404).json({
        success: false,
        message: "Raffle not found",
      });
      return;
    }

    res.json({
      success: true,
      raffle,
    });
  })
);

/**
 * Cancel a raffle.
 *
 * Only the creator can cancel it.
 */
router.post(
  "/:id/cancel",
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const raffleId = getRaffleId(req, res);
    if (!raffleId) return;

    const raffle = await prisma.raffle.findUnique({
      where: {
        id: raffleId,
      },
    });

    if (!raffle) {
      res.status(404).json({
        success: false,
        message: "Raffle not found",
      });
      return;
    }

    if (raffle.createdByUserId !== req.userId) {
      res.status(403).json({
        success: false,
        message: "Only the raffle creator can cancel this raffle",
      });
      return;
    }

    if (raffle.cancelledAt) {
      res.status(400).json({
        success: false,
        message: "Raffle is already cancelled",
      });
      return;
    }

    const cancelled = await prisma.raffle.update({
      where: {
        id: raffle.id,
      },
      data: {
        cancelledAt: new Date(),
        status: "CANCELLED",
      },
    });

    res.json({
      success: true,
      raffle: cancelled,
    });
  })
);


router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const raffleId = req.params.id;

    if (!raffleId || Array.isArray(raffleId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid raffle ID",
      });
    }

    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const parsed = z.object({
      status: z.enum([
        "DRAFT",
        "SCHEDULED",
        "ACTIVE",
        "CLOSED",
        "DRAWING",
        "COMPLETED",
        "CANCELLED",
      ]),
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid raffle status",
        errors: z.treeifyError(parsed.error),
      });
    }

    const raffle = await prisma.raffle.findUnique({
      where: { id: raffleId },
    });

    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: "Raffle not found",
      });
    }

    if (raffle.createdByUserId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Only the raffle creator can update this raffle",
      });
    }

    const updated = await prisma.raffle.update({
      where: { id: raffleId },
      data: {
        status: parsed.data.status,
      },
    });

    return res.json({
      success: true,
      raffle: updated,
    });
  } catch (error) {
    next(error);
  }
});


/**
 * POST /api/raffles/:id/draw
 *
 * Executes the deterministic/auditable raffle draw.
 * Only the raffle creator can trigger the draw.
 */
router.post("/:id/draw", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const raffleId = getRaffleId(req, res);
    if (!raffleId) return;

    const result = await drawRaffle(
      raffleId,
      req.userId,
    );

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});


/**
 * POST /api/raffles/:id/winners/:winnerId/notify
 *
 * Marks a selected winner as notified.
 */
router.post(
  "/:id/winners/:winnerId/notify",
  requireAuth,
  async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const raffleId = getRaffleId(req, res);
      if (!raffleId) return;

      const winnerId = Array.isArray(req.params.winnerId) ? req.params.winnerId[0] : req.params.winnerId;

      if (!winnerId) {
        return res.status(400).json({
          success: false,
          message: "Invalid winner ID",
        });
      }

      const winner = await prisma.raffleWinner.findUnique({
        where: { id: winnerId },
      });

      if (!winner || winner.raffleId !== raffleId) {
        return res.status(404).json({
          success: false,
          message: "Raffle winner not found",
        });
      }

      if (winner.userId !== req.userId) {
        return res.status(403).json({
          success: false,
          message: "Only the winner can receive this notification",
        });
      }

      const updated = await notifyWinner(
        raffleId,
        winnerId,
      );

      return res.json({
        success: true,
        winner: updated,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/raffles/:id/winners/:winnerId/claim
 *
 * Claims a raffle prize for the selected winner.
 */
router.post(
  "/:id/winners/:winnerId/claim",
  requireAuth,
  async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const raffleId = getRaffleId(req, res);
      if (!raffleId) return;

      const winnerId = Array.isArray(req.params.winnerId) ? req.params.winnerId[0] : req.params.winnerId;

      if (!winnerId) {
        return res.status(400).json({
          success: false,
          message: "Invalid winner ID",
        });
      }

      try {
        const winner = await claimWinner(
          raffleId,
          winnerId,
          req.userId,
        );

        return res.json({
          success: true,
          winner,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to claim raffle prize";

        if (message === "Raffle winner not found") {
          return res.status(404).json({
            success: false,
            message,
          });
        }

        if (message === "Only the selected winner can claim this prize") {
          return res.status(403).json({
            success: false,
            message,
          });
        }

        return res.status(400).json({
          success: false,
          message,
        });
      }
    } catch (error) {
      next(error);
    }
  },
);

export default router;
