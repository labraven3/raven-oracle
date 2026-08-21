import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { evaluateRaffleEntry } from "../services/eligibility.service.js";
import { verifyCaptchaToken } from "../services/captcha.service.js";
import { verifyRaffleEligibility } from "../services/raffle-eligibility.service.js";

const router = Router();
const enterSchema = z.object({ walletAddressId: z.string().uuid(), captchaToken: z.string().trim().optional() });
function getIdParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function rules(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

router.post("/:raffleId/entries", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const parsed = enterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid entry data", errors: z.treeifyError(parsed.error) });
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    const now = new Date();
    if (raffle.status !== "ACTIVE") return res.status(400).json({ success: false, message: raffle.status === "SCHEDULED" ? "Raffle has not started yet" : "Raffle is not accepting entries" });
    if (now < raffle.startsAt) return res.status(400).json({ success: false, message: "Raffle has not started yet" });
    if (now > raffle.endsAt) return res.status(400).json({ success: false, message: "Raffle entry window is closed" });

    const entryRules = rules(raffle.entryRules);
    const captchaRequired = entryRules.captchaRequired === true;
    const captcha = await verifyCaptchaToken(parsed.data.captchaToken, req.ip);
    if (captchaRequired && !captcha.verified) {
      return res.status(400).json({ success: false, message: captcha.reason || "Captcha verification is required", captchaConfigured: captcha.configured });
    }

    const wallet = await prisma.walletAddress.findFirst({ where: { id: parsed.data.walletAddressId, userId: req.userId, status: "ACTIVE", deletedAt: null } });
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
        captchaPassed: captchaRequired ? captcha.verified : (captcha.configured ? captcha.verified : null),
        eligibilityReasons: { pending: "Eligibility evaluation has not yet completed" },
        accountAgeDaysAtEntry: null,
        walletAgeDaysAtEntry: null,
        socialVerifiedAtEntry: false,
      },
      include: { walletAddress: { select: { id: true, address: true, normalizedAddress: true, chain: true, network: true } } },
    });
    return res.status(201).json({ success: true, entry, captcha: { required: captchaRequired, verified: captcha.verified, configured: captcha.configured } });
  } catch (error) { next(error); }
});

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const entries = await prisma.raffleEntry.findMany({ where: { userId: req.userId }, orderBy: { enteredAt: "desc" }, take: 100, include: { raffle: { include: { project: { select: { id: true, name: true, logoUrl: true, category: true } } } }, walletAddress: { select: { address: true, chain: true, network: true } } } });
    return res.json({ success: true, entries });
  } catch (error) { next(error); }
});

router.get("/:raffleId/entries/me", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const entry = await prisma.raffleEntry.findUnique({ where: { raffleId_userId: { raffleId, userId: req.userId } }, include: { walletAddress: { select: { id: true, address: true, normalizedAddress: true, chain: true, network: true } } } });
    if (!entry) return res.status(404).json({ success: false, message: "You have not entered this raffle" });
    return res.json({ success: true, entry });
  } catch (error) { next(error); }
});

router.get("/:raffleId/entries", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);
    if (!raffleId) return res.status(400).json({ success: false, message: "Invalid raffle ID" });
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { createdByUserId: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    if (raffle.createdByUserId !== req.userId) return res.status(403).json({ success: false, message: "Only the raffle creator can view entries" });
    const entries = await prisma.raffleEntry.findMany({ where: { raffleId }, select: { id: true, userId: true, walletAddressId: true, status: true, eligibilityReasons: true, riskScore: true, riskLevel: true, captchaPassed: true, socialVerifiedAtEntry: true, enteredAt: true, createdAt: true, updatedAt: true }, orderBy: { enteredAt: "asc" } });
    return res.json({ success: true, entries });
  } catch (error) { next(error); }
});

router.post("/:raffleId/entries/evaluate", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, createdByUserId: true, status: true, endsAt: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    if (raffle.createdByUserId !== req.userId) return res.status(403).json({ success: false, message: "Only the raffle creator can evaluate entries" });
    if (!["CLOSED", "DRAWING"].includes(raffle.status)) return res.status(400).json({ success: false, message: "Close the raffle before evaluating entries" });
    if (new Date() < raffle.endsAt) return res.status(400).json({ success: false, message: "Raffle cannot be evaluated before its end time" });
    const pending = await prisma.raffleEntry.findMany({ where: { raffleId, status: "PENDING" }, select: { id: true } });
    let eligible = 0; let ineligible = 0; let failed = 0;
    for (const entry of pending) {
      try {
        const result = await evaluateRaffleEntry(entry.id);
        if (result.eligible) eligible += 1; else ineligible += 1;
      } catch { failed += 1; }
    }
    const counts = await prisma.raffleEntry.groupBy({ by: ["status"], where: { raffleId }, _count: { _all: true } });
    return res.json({ success: true, evaluated: pending.length, eligible, ineligible, failed, counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])) });
  } catch (error) { next(error); }
});

router.post("/:raffleId/entries/:entryId/evaluate", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId); const entryId = getIdParam(req.params.entryId);
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
    const entry = await prisma.raffleEntry.findUnique({ where: { raffleId_userId: { raffleId, userId: req.userId } } });
    if (!entry) return res.status(404).json({ success: false, message: "You must enter the raffle before verifying tasks" });
    const result = await verifyRaffleEligibility(raffleId, entry.id, req.userId);
    return res.json({ success: true, allRequiredTasksVerified: result.eligible, verifiedCount: result.verifiedCount, totalTasks: result.totalTasks, requiredTasks: result.requiredTasks, tasks: result.tasks, failedRequiredTasks: result.failedRequiredTasks, eligibility: result.eligibility, entry: result.entry });
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
