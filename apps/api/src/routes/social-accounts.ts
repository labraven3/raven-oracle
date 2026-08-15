import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const providerSchema = z.enum(["DISCORD", "X"]);

const createSchema = z.object({
  provider: providerSchema,
  providerAccountId: z.string().min(1).max(255),
  providerUsername: z.string().max(255).nullable().optional(),
  displayName: z.string().max(255).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const accounts = await prisma.socialAccount.findMany({
      where: {
        userId: req.userId,
        isActive: true,
      },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        providerUsername: true,
        displayName: true,
        avatarUrl: true,
        isActive: true,
        connectedAt: true,
      },
      orderBy: {
        connectedAt: "desc",
      },
    });

    return res.json({
      success: true,
      accounts,
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

    const parsed = createSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid social account data",
        errors: z.treeifyError(parsed.error),
      });
    }

    const existing = await prisma.socialAccount.findFirst({
      where: {
        userId: req.userId,
        provider: parsed.data.provider,
        providerAccountId: parsed.data.providerAccountId,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Social account already connected",
      });
    }

    const account = await prisma.socialAccount.create({
      data: {
        userId: req.userId,
        provider: parsed.data.provider,
        providerAccountId: parsed.data.providerAccountId,
        providerUsername: parsed.data.providerUsername ?? null,
        displayName: parsed.data.displayName ?? null,
        avatarUrl: parsed.data.avatarUrl ?? null,
      },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        providerUsername: true,
        displayName: true,
        avatarUrl: true,
        isActive: true,
        connectedAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      account,
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

    const accountId = req.params.id;

    if (typeof accountId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid social account ID",
      });
    }

    const account = await prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        userId: req.userId,
      },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Social account not found",
      });
    }

    await prisma.socialAccount.update({
      where: { id: account.id },
      data: { isActive: false },
    });

    return res.json({
      success: true,
      message: "Social account disconnected",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
