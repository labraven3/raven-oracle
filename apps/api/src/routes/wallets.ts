import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { 
  isValidEvmAddress, 
  isValidSolanaAddress, 
  normalizeEvmAddress, 
  normalizeSolanaAddress,
  detectAndValidateAddress 
} from "../lib/wallet-validation.js";

const router = Router();

const walletSchema = z.object({
  address: z.string().min(1).max(255),
  chain: z.enum(["EVM", "SOLANA"]).optional(),
  label: z.string().min(1).max(100).optional(),
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
        deletedAt: null, // Only show non-archived wallets
      },
      orderBy: [
        { isPrimary: "desc" }, // Primary wallet first
        { createdAt: "desc" },
      ],
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

    const { address, chain: providedChain, label } = parsed.data;

    // Detect and validate address
    const detection = detectAndValidateAddress(address);

    if (!detection.valid) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet address format",
      });
    }

    // Use detected chain or provided chain
    const chain = providedChain || detection.chain!;
    const normalizedAddress = detection.normalized!;

    // Validate chain matches if both provided
    if (providedChain && providedChain !== detection.chain) {
      return res.status(400).json({
        success: false,
        message: `Address format does not match ${providedChain} chain`,
      });
    }

    // Validate address format for specific chain
    if (chain === "EVM" && !isValidEvmAddress(address)) {
      return res.status(400).json({
        success: false,
        message: "Invalid EVM address format",
      });
    }

    if (chain === "SOLANA" && !isValidSolanaAddress(address)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Solana address format",
      });
    }

    // Check if wallet already exists for THIS user
    const existingForUser = await prisma.walletAddress.findFirst({
      where: {
        userId: req.userId,
        chain,
        normalizedAddress,
        deletedAt: null,
      },
    });

    if (existingForUser) {
      return res.status(409).json({
        success: false,
        message: "You have already added this wallet address",
      });
    }

    // TASK 2: Check if wallet exists for ANY user (prevent duplicate ownership)
    const existingForOthers = await prisma.walletAddress.findFirst({
      where: {
        chain,
        normalizedAddress,
        deletedAt: null,
        userId: {
          not: req.userId,
        },
      },
    });

    if (existingForOthers) {
      return res.status(409).json({
        success: false,
        message: "This wallet address is already registered to another account",
      });
    }

    const wallet = await prisma.walletAddress.create({
      data: {
        userId: req.userId,
        address,
        normalizedAddress,
        chain,
        network:
          chain === "SOLANA"
            ? "solana-mainnet"
            : "ethereum-mainnet",
        label: label || null,
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
        deletedAt: null,
      },
    });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    // Soft delete (archive) instead of hard delete
    await prisma.walletAddress.update({
      where: {
        id: wallet.id,
      },
      data: {
        deletedAt: new Date(),
        status: "ARCHIVED",
      },
    });

    return res.json({
      success: true,
      message: "Wallet archived",
    });
  } catch (error) {
    next(error);
  }
});

// Update wallet (label, primary status)
const updateWalletSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  isPrimary: z.boolean().optional(),
});

router.patch("/:id", requireAuth, async (req, res, next) => {
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

    const parsed = updateWalletSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid update data",
        errors: z.treeifyError(parsed.error),
      });
    }

    const wallet = await prisma.walletAddress.findFirst({
      where: {
        id: walletId,
        userId: req.userId,
        deletedAt: null,
      },
    });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    // If setting as primary, unset other primary wallets
    if (parsed.data.isPrimary === true) {
      await prisma.walletAddress.updateMany({
        where: {
          userId: req.userId,
          isPrimary: true,
          id: { not: walletId },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (parsed.data.label !== undefined) {
      updateData.label = parsed.data.label;
    }
    if (parsed.data.isPrimary !== undefined) {
      updateData.isPrimary = parsed.data.isPrimary;
    }

    const updated = await prisma.walletAddress.update({
      where: { id: walletId },
      data: updateData as any,
    });

    return res.json({
      success: true,
      wallet: updated,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
