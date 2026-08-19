import { Router, type NextFunction, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { role: true, status: true, isAdminApproved: true },
  });

  if (!user || user.status === "BANNED" || user.role !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }

  if (!user.isAdminApproved) {
    return res.status(403).json({
      success: false,
      message: "Admin access pending approval. Please contact the administrator.",
    });
  }

  next();
}

router.use(
  (req, res, next) => requireAuth(req, res, next, "admin"),
  requireAdmin
);

const activityRelations = {
  submittedProjects: true,
  projectRatings: true,
  raffleEntries: true,
  createdRaffles: true,
  raffleWinners: true,
  alphaSubmissions: true,
  pointTransactions: true,
  createdPointTxns: true,
  chatMessages: true,
  raffleTaskVerifications: true,
  socialAccounts: true,
  walletAddresses: true,
} as const;

router.get("/", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: "USER",
        status: "PENDING",
        emailVerifiedAt: null,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
        _count: { select: activityRelations },
      },
    });

    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        deletedAt: true,
        _count: { select: activityRelations },
      },
    });

    if (!user || user.deletedAt) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (
      user.role !== "USER" ||
      user.status !== "PENDING" ||
      user.emailVerifiedAt !== null
    ) {
      return res.status(403).json({
        success: false,
        message: "Only unverified pending user accounts can be permanently deleted here.",
      });
    }

    const activityCount = Object.values(user._count).reduce((sum, count) => sum + count, 0);
    if (activityCount > 0) {
      return res.status(409).json({
        success: false,
        message: "This account has activity and cannot be permanently deleted from this cleanup screen.",
      });
    }

    const actorId = req.userId!;

    await prisma.$transaction(async (tx) => {
      await tx.authAuditLog.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: "ADMIN_ACTION",
          entityType: "User",
          entityId: user.id,
          summary: `Permanently deleted unverified pending user${user.email ? `: ${user.email}` : ""}`,
          metadata: { action: "DELETE_UNVERIFIED_PENDING_USER" },
        },
      });
    });

    res.json({ success: true, message: "Unverified user permanently deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
