import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const walletSchema = z.object({
  address: z.string().min(1).max(255),
  chain: z.enum(["EVM", "SOLANA"]),
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const wallets = await prisma.walletAddress.findMany({
      where: {
        userId: req.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      wallets,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const parsed = walletSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet data",
        errors: z.treeifyError(parsed.error),
      });
    }

    const existing = await prisma.walletAddress.findFirst({
      where: {
        userId: req.userId,
        address: parsed.data.address,
        chain: parsed.data.chain,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Wallet already connected",
      });
    }

    const wallet = await prisma.walletAddress.create({
      data: {
        userId: req.userId,
        address: parsed.data.address,
        normalizedAddress: parsed.data.address.toLowerCase(),
        chain: parsed.data.chain,
        network:
          parsed.data.chain === "SOLANA"
            ? "solana-mainnet"
            : "ethereum-mainnet",
      },
    });

    return res.status(201).json({
      success: true,
      wallet,
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const walletId = req.params.id;

    if (typeof walletId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet ID",
      });
    }

    const wallet = await prisma.walletAddress.findFirst({
      where: {
        id: walletId,
        userId: req.userId,
      },
    });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    await prisma.walletAddress.delete({
      where: {
        id: wallet.id,
      },
    });

    return res.json({
      success: true,
      message: "Wallet removed",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
