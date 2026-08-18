import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const updateProfileSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must not exceed 32 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens")
    .optional(),
  displayName: z.string()
    .min(1, "Display name is required")
    .max(80, "Display name must not exceed 80 characters")
    .optional(),
  avatarUrl: z.string()
    .url("Avatar URL must be a valid URL")
    .max(500, "Avatar URL too long")
    .nullable()
    .optional(),
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const parsed = updateProfileSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid profile data",
        errors: parsed.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    // Check username uniqueness if username is being updated
    if (parsed.data.username) {
      const existingUser = await prisma.user.findUnique({
        where: { username: parsed.data.username },
      });

      if (existingUser && existingUser.id !== req.userId) {
        return res.status(409).json({
          success: false,
          message: "Username is already taken",
        });
      }
    }

    const data = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined)
    );

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
    });

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
