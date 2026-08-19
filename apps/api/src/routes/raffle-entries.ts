import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { evaluateRaffleEntry } from "../services/eligibility.service.js";
import { verifyRaffleEligibility } from "../services/raffle-eligibility.service.js";

const router = Router();

const enterSchema = z.object({
  walletAddressId: z.string().uuid(),
});

function getIdParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

router.post("/:raffleId/entries", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });

    const parsed = enterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid entry data", errors: z.treeifyError(parsed.error) });

    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });

    const now = new Date();
    if (raffle.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: raffle.status === "SCHEDULED" ? "Raffle has not started yet" : "Raffle is not accepting entries",
      });
    }
    if (now < raffle.startsAt) return res.status(400).json({ success: false, message: "Raffle has not started yet" });
    if (now > raffle.endsAt) return res.status(400).json({ success: false, message: "Raffle entry window is closed" });

    const wallet = await prisma.walletAddress.findFirst({
      where: { id: parsed.data.walletAddressId, userId: req.userId, status: "ACTIVE", deletedAt: null },
    });
    if (!wallet) return res.status(400).json({ success: false, message: "Wallet does not belong to this user or is inactive" });

    const existingUserEntry = await prisma.raffleEntry.findUnique({ where: { raffleId_userId: { raffleId, userId: req.userId } } });
    if (existingUserEntry) return res.status(409).json({ success: false, message: "You have already entered this raffle", entry: existingUserEntry });

    const existingWalletEntry = await prisma.raffleEntry.findUnique({ where: { raffleId_walletAddressId: { raffleId, walletAddressId: wallet.id } } });
    if (existingWalletEntry) return res.status(409).json({ success: false, message: "This wallet has already entered this raffle", entry: existingWalletEntry });

    const entry = await prisma.raffleEntry.create({
      data: {
        raffleId,
        userId: req.userId,
        walletAddressId: wallet.id,
        walletAddressSnapshot: wallet.address,
        status: "PENDING",
        eligibilityReasons: { pending: "Eligibility evaluation has not yet completed" },
        accountAgeDaysAtEntry: null,
        walletAgeDaysAtEntry: null,
        socialVerifiedAtEntry: false,
      },
      include: {
        walletAddress: { select: { id: true, address: true, normalizedAddress: true, chain: true, network: true } },
      },
    });

    return res.status(201).json({ success: true, entry });
  } catch (error) { next(error); }
});

router.get("/:raffleId/entries/me", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });

    const entry = await prisma.raffleEntry.findUnique({
      where: { raffleId_userId: { raffleId, userId: req.userId } },
      include: { walletAddress: { select: { id: true, address: true, normalizedAddress: true, chain: true, network: true } } },
    });
    if (!entry) return res.status(404).json({ success: false, message: "You have not entered this raffle" });
    return res.json({ success: true, entry });
  } catch (error) { next(error); }
});

router.get("/:raffleId/entries", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);
    if (!raffleId) return res.status(400).json({ success: false, message: "Invalid raffle ID" });

    // Verify the user is the raffle creator
    const raffle = await prisma.raffle.findUnique({
      where: { id: raffleId },
      select: { createdByUserId: true }
    });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    if (raffle.createdByUserId !== req.userId) {
      return res.status(403).json({ success: false, message: "Only the raffle creator can view entries" });
    }

    const entries = await prisma.raffleEntry.findMany({
      where: { raffleId },
      select: {
        id: true, userId: true, walletAddressId: true, status: true,
        eligibilityReasons: true, riskScore: true, riskLevel: true,
        captchaPassed: true, socialVerifiedAtEntry: true, enteredAt: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { enteredAt: "asc" },
    });
    return res.json({ success: true, entries });
  } catch (error) { next(error); }
});

router.post("/:raffleId/entries/:entryId/evaluate", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);
    const entryId = getIdParam(req.params.entryId);
    if (!raffleId || !entryId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle, entry, or authentication" });

    const entry = await prisma.raffleEntry.findUnique({ where: { id: entryId }, include: { raffle: true } });
    if (!entry || entry.raffleId !== raffleId) return res.status(404).json({ success: false, message: "Raffle entry not found" });
    if (entry.raffle.createdByUserId !== req.userId) return res.status(403).json({ success: false, message: "Only the raffle creator can evaluate entries" });

    const result = await evaluateRaffleEntry(entryId);
    const updatedEntry = await prisma.raffleEntry.findUnique({ where: { id: entryId } });
    return res.json({ success: true, result, entry: updatedEntry });
  } catch (error) { next(error); }
});

router.post("/:raffleId/entries/me/verify-tasks", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });

    const entry = await prisma.raffleEntry.findUnique({
      where: { raffleId_userId: { raffleId, userId: req.userId } },
    });
    if (!entry) return res.status(404).json({ success: false, message: "You must enter the raffle before verifying tasks" });

    const result = await verifyRaffleEligibility(raffleId, entry.id, req.userId);
    return res.json({
      success: true,
      allRequiredTasksVerified: result.eligible,
      verifiedCount: result.verifiedCount,
      totalTasks: result.totalTasks,
      requiredTasks: result.requiredTasks,
      tasks: result.tasks,
      failedRequiredTasks: result.failedRequiredTasks,
      entry: result.entry,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify raffle tasks";
    const status = message.includes("not started") || message.includes("ended") || message.includes("not accepting") ? 400 : 500;
    return res.status(status).json({ success: false, message });
  }
});

router.post("/:raffleId/entries/me/verify", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });

    const entry = await prisma.raffleEntry.findUnique({ where: { raffleId_userId: { raffleId, userId: req.userId } } });
    if (!entry) return res.status(404).json({ success: false, message: "Enter the raffle before verifying eligibility" });

    const result = await verifyRaffleEligibility(raffleId, entry.id, req.userId);
    return res.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify eligibility";
    const status = message.includes("not started") || message.includes("ended") || message.includes("not accepting") ? 400 : 500;
    return res.status(status).json({ success: false, message });
  }
});

export default router;
