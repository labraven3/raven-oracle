import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function getRules(value: Prisma.JsonValue): Prisma.InputJsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Prisma.InputJsonObject) }
    : {};
}

router.get("/mine", async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const raffles = await prisma.raffle.findMany({
      where: { createdByUserId: req.userId, cancelledAt: null },
      orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, title: true, status: true, startsAt: true, endsAt: true, entryRules: true, project: { select: { id: true, name: true, logoUrl: true } } },
    });
    return res.json({ success: true, raffles: raffles.map((raffle) => ({ ...raffle, captchaRequired: getRules(raffle.entryRules).captchaRequired === true })) });
  } catch (error) { next(error); }
});

router.patch("/:raffleId", async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const parsed = z.object({ captchaRequired: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "captchaRequired must be a boolean" });
    const raffle = await prisma.raffle.findFirst({ where: { id: req.params.raffleId, createdByUserId: req.userId, cancelledAt: null }, select: { id: true, status: true, entryRules: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    if (["CLOSED", "DRAWING", "COMPLETED", "CANCELLED"].includes(raffle.status)) return res.status(400).json({ success: false, message: "Security settings can only be changed before the raffle is completed" });
    const rules = getRules(raffle.entryRules);
    rules.captchaRequired = parsed.data.captchaRequired;
    const updated = await prisma.raffle.update({ where: { id: raffle.id }, data: { entryRules: rules } });
    return res.json({ success: true, raffle: { id: updated.id, status: updated.status, captchaRequired: parsed.data.captchaRequired } });
  } catch (error) { next(error); }
});

export default router;
