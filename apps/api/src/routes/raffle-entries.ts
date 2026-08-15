import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const enterSchema = z.object({
  walletAddressId: z.string().uuid(),
});

function getIdParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * POST /api/raffles/:raffleId/entries
 *
 * Creates an authenticated raffle entry.
 *
 * Initial status is PENDING. Eligibility/risk evaluation is intentionally
 * separated from entry creation so the entry itself remains auditable.
 */
router.post("/:raffleId/entries", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);

    if (!raffleId || !req.userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid raffle or authentication",
      });
    }

    const parsed = enterSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid entry data",
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

    const now = new Date();

    if (raffle.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Raffle is not accepting entries",
      });
    }

    if (now < raffle.startsAt || now > raffle.endsAt) {
      return res.status(400).json({
        success: false,
        message: "Raffle entry window is closed",
      });
    }

    const wallet = await prisma.walletAddress.findFirst({
      where: {
        id: parsed.data.walletAddressId,
        userId: req.userId,
        status: "ACTIVE",
        deletedAt: null,
      },
    });

    if (!wallet) {
      return res.status(400).json({
        success: false,
        message: "Wallet does not belong to this user or is inactive",
      });
    }

    const existingUserEntry = await prisma.raffleEntry.findUnique({
      where: {
        raffleId_userId: {
          raffleId,
          userId: req.userId,
        },
      },
    });

    if (existingUserEntry) {
      return res.status(409).json({
        success: false,
        message: "You have already entered this raffle",
        entry: existingUserEntry,
      });
    }

    const existingWalletEntry = await prisma.raffleEntry.findUnique({
      where: {
        raffleId_walletAddressId: {
          raffleId,
          walletAddressId: wallet.id,
        },
      },
    });

    if (existingWalletEntry) {
      return res.status(409).json({
        success: false,
        message: "This wallet has already entered this raffle",
        entry: existingWalletEntry,
      });
    }

    const entry = await prisma.raffleEntry.create({
      data: {
        raffleId,
        userId: req.userId,
        walletAddressId: wallet.id,
        walletAddressSnapshot: wallet.address,
        status: "PENDING",
        eligibilityReasons: {
          pending: "Eligibility evaluation has not yet completed",
        },
        accountAgeDaysAtEntry: null,
        walletAgeDaysAtEntry: null,
        socialVerifiedAtEntry: false,
      },
      include: {
        walletAddress: {
          select: {
            id: true,
            address: true,
            normalizedAddress: true,
            chain: true,
            network: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      entry,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/raffles/:raffleId/entries/me
 */
router.get("/:raffleId/entries/me", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);

    if (!raffleId || !req.userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid raffle or authentication",
      });
    }

    const entry = await prisma.raffleEntry.findUnique({
      where: {
        raffleId_userId: {
          raffleId,
          userId: req.userId,
        },
      },
      include: {
        walletAddress: {
          select: {
            id: true,
            address: true,
            normalizedAddress: true,
            chain: true,
            network: true,
          },
        },
      },
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "You have not entered this raffle",
      });
    }

    return res.json({
      success: true,
      entry,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/raffles/:raffleId/entries
 *
 * Admin/creator-facing entry listing will be protected later by role
 * authorization. For now this exposes the authenticated user's entries only
 * through the /me endpoint above.
 */
router.get("/:raffleId/entries", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);

    if (!raffleId) {
      return res.status(400).json({
        success: false,
        message: "Invalid raffle ID",
      });
    }

    const entries = await prisma.raffleEntry.findMany({
      where: {
        raffleId,
      },
      select: {
        id: true,
        userId: true,
        walletAddressId: true,
        status: true,
        eligibilityReasons: true,
        riskScore: true,
        riskLevel: true,
        captchaPassed: true,
        socialVerifiedAtEntry: true,
        enteredAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        enteredAt: "asc",
      },
    });

    return res.json({
      success: true,
      entries,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
