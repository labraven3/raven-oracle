import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { evaluateRaffleEntry } from "../services/eligibility.service.js";
import { verifyCaptchaToken } from "../services/captcha.service.js";

const router = Router();
router.use(requireAuth);

function getId(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function captchaRequired(entryRules: unknown) {
  return !!entryRules && typeof entryRules === "object" && !Array.isArray(entryRules)
    && (entryRules as Record<string, unknown>).captchaRequired === true;
}

router.post("/:raffleId/verify", async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const raffleId = getId(req.params.raffleId);
    if (!raffleId) return res.status(400).json({ success: false, message: "Invalid raffle ID" });

    const raffle = await prisma.raffle.findUnique({
      where: { id: raffleId },
      select: { id: true, status: true, endsAt: true, startsAt: true, entryRules: true },
    });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    if (!captchaRequired(raffle.entryRules)) return res.json({ success: true, required: false, verified: true });

    const entry = await prisma.raffleEntry.findUnique({ where: { raffleId_userId: { raffleId, userId: req.userId } } });
    if (!entry) return res.status(400).json({ success: false, message: "Enter the raffle before verifying CAPTCHA" });

    const now = new Date();
    if (raffle.status !== "ACTIVE" || now < raffle.startsAt || now > raffle.endsAt) {
      return res.status(400).json({ success: false, message: "CAPTCHA can only be verified while the raffle is active" });
    }

    const result = await verifyCaptchaToken(req.body?.token, req.ip);
    if (!result.verified) {
      await prisma.raffleEntry.update({ where: { id: entry.id }, data: { captchaPassed: false, eligibilityCheckedAt: new Date() } });
      return res.status(400).json({ success: false, required: true, verified: false, message: result.reason });
    }

    const updated = await prisma.raffleEntry.update({ where: { id: entry.id }, data: { captchaPassed: true, eligibilityCheckedAt: new Date() } });
    const eligibility = await evaluateRaffleEntry(updated.id);
    return res.json({ success: true, required: true, verified: true, eligibility, entry: updated });
  } catch (error) { next(error); }
});

export default router;
