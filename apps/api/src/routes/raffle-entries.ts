import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { evaluateRaffleEntry } from "../services/eligibility.service.js";
import { verifyCaptchaToken } from "../services/captcha.service.js";
import { verifyRaffleEligibility } from "../services/raffle-eligibility.service.js";

const router = Router();
const enterSchema = z.object({ walletAddressId: z.string().uuid().optional(), captchaToken: z.string().trim().optional() });
const walletAttachSchema = z.object({ walletAddressId: z.string().uuid() });
function getIdParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function rules(value: Prisma.JsonValue): Prisma.InputJsonObject { return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Prisma.InputJsonObject) } : {}; }

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
    const finalWalletSubmission = Boolean(parsed.data.walletAddressId);
    if (captchaRequired && finalWalletSubmission && !captcha.verified) return res.status(400).json({ success: false, message: captcha.reason || "CAPTCHA verification is required before wallet submission", captchaConfigured: captcha.configured });

    const existingUserEntry = await prisma.raffleEntry.findUnique({ where: { raffleId_userId: { raffleId, userId: req.userId } } });
    if (existingUserEntry) return res.status(409).json({ success: false, message: "You have already started this raffle entry", entry: existingUserEntry });

    let wallet: { id: string; address: string; chain: "EVM" | "SOLANA"; network: string } | null = null;
    if (parsed.data.walletAddressId) {
      wallet = await prisma.walletAddress.findFirst({ where: { id: parsed.data.walletAddressId, userId: req.userId, status: "ACTIVE", deletedAt: null }, select: { id: true, address: true, chain: true, network: true } });
      if (!wallet) return res.status(400).json({ success: false, message: "Wallet does not belong to this user or is inactive" });
      const existingWalletEntry = await prisma.raffleEntry.findUnique({ where: { raffleId_walletAddressId: { raffleId, walletAddressId: wallet.id } } });
      if (existingWalletEntry) return res.status(409).json({ success: false, message: "This wallet has already entered this raffle", entry: existingWalletEntry });
    }

    const entry = await prisma.raffleEntry.create({
      data: {
        raffleId,
        userId: req.userId,
        walletAddressId: wallet?.id ?? null,
        walletAddressSnapshot: wallet?.address ?? null,
        status: "PENDING",
        captchaPassed: finalWalletSubmission ? captcha.verified : null,
        eligibilityReasons: { pending: wallet ? "Eligibility evaluation has not yet completed" : "Complete the required tasks, then submit your payout wallet" },
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
    if (!entry) return res.status(404).json({ success: false, message: "You have not started this raffle entry" });
    return res.json({ success: true, entry });
  } catch (error) { next(error); }
});

router.patch("/:raffleId/entries/me/wallet", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const parsed = walletAttachSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "A wallet address is required", errors: z.treeifyError(parsed.error) });
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, status: true, startsAt: true, endsAt: true, entryRules: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    const now = new Date();
    if (raffle.status !== "ACTIVE" || now < raffle.startsAt || now > raffle.endsAt) return res.status(400).json({ success: false, message: "This raffle is not accepting wallet submissions" });
    const entry = await prisma.raffleEntry.findUnique({ where: { raffleId_userId: { raffleId, userId: req.userId } } });
    if (!entry) return res.status(404).json({ success: false, message: "Complete the raffle tasks first" });
    if (["WINNER", "NOT_SELECTED", "DISQUALIFIED"].includes(entry.status)) return res.status(400).json({ success: false, message: "This raffle entry can no longer be changed" });
    const entryRules = rules(raffle.entryRules);
    const captchaRequired = entryRules.captchaRequired === true;
    if (captchaRequired && entry.captchaPassed !== true) return res.status(400).json({ success: false, message: "Complete the CAPTCHA before submitting your payout wallet" });
    const wallet = await prisma.walletAddress.findFirst({ where: { id: parsed.data.walletAddressId, userId: req.userId, status: "ACTIVE", deletedAt: null }, select: { id: true, address: true, chain: true, network: true } });
    if (!wallet) return res.status(400).json({ success: false, message: "Wallet does not belong to this user or is inactive" });
    const used = await prisma.raffleEntry.findFirst({ where: { raffleId, walletAddressId: wallet.id, userId: { not: req.userId } }, select: { id: true } });
    if (used) return res.status(409).json({ success: false, message: "This wallet has already been used in this raffle" });
    const updated = await prisma.raffleEntry.update({ where: { id: entry.id }, data: { walletAddressId: wallet.id, walletAddressSnapshot: wallet.address, status: "PENDING" }, include: { walletAddress: { select: { id: true, address: true, normalizedAddress: true, chain: true, network: true } } } });
    return res.json({ success: true, entry: updated });
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
    for (const entry of pending) { try { const result = await evaluateRaffleEntry(entry.id); if (result.status === "ELIGIBLE") eligible += 1; else ineligible += 1; } catch { failed += 1; } }
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
    const result = await evaluateRaffleEntry(entryId); const updatedEntry = await prisma.raffleEntry.findUnique({ where: { id: entryId } });
    return res.json({ success: true, result, entry: updatedEntry });
  } catch (error) { next(error); }
});

router.post("/:raffleId/entries/me/verify-tasks", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const entry = await prisma.raffleEntry.findUnique({ where: { raffleId_userId: { raffleId, userId: req.userId } } });
    if (!entry) return res.status(404).json({ success: false, message: "Start the raffle entry before verifying tasks" });
    const result = await verifyRaffleEligibility(raffleId, entry.id, req.userId);
    return res.json({ success: true, allRequiredTasksVerified: result.eligible, verifiedCount: result.verifiedCount, totalTasks: result.totalTasks, requiredTasks: result.requiredTasks, tasks: result.tasks, failedRequiredTasks: result.failedRequiredTasks, eligibility: result.eligibility, entry: result.entry });
  } catch (error) { const message = error instanceof Error ? error.message : "Unable to verify raffle tasks"; const status = message.includes("not started") || message.includes("ended") || message.includes("not accepting") ? 400 : 500; return res.status(status).json({ success: false, message }); }
});

router.post("/:raffleId/entries/me/verify", requireAuth, async (req, res, next) => {
  try {
    const raffleId = getIdParam(req.params.raffleId);
    if (!raffleId || !req.userId) return res.status(400).json({ success: false, message: "Invalid raffle or authentication" });
    const entry = await prisma.raffleEntry.findUnique({ where: { raffleId_userId: { raffleId, userId: req.userId } } });
    if (!entry) return res.status(404).json({ success: false, message: "Start the raffle entry before verifying eligibility" });
    const result = await verifyRaffleEligibility(raffleId, entry.id, req.userId);
    return res.json({ success: true, ...result });
  } catch (error) { const message = error instanceof Error ? error.message : "Unable to verify eligibility"; const status = message.includes("not started") || message.includes("ended") || message.includes("not accepting") ? 400 : 500; return res.status(status).json({ success: false, message }); }
});

export default router;
