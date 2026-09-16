import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { publishDiscordGiveaway, verifyDiscordChannel, type DiscordPromotionConfig } from "../services/discord-publisher.service.js";

const router = Router();

function raffleUrl(id: string) { return `${env.WEB_ORIGIN}/raffles/${id}`; }

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readPromotion(entryRules: unknown): DiscordPromotionConfig {
  const rules = objectRecord(entryRules);
  return objectRecord(rules.discordPromotion) as DiscordPromotionConfig;
}

async function getOwnedRaffle(req: Request, res: Response) {
  if (!req.userId) { res.status(401).json({ success: false, message: "Authentication required" }); return null; }
  const id = typeof req.params.id === "string" ? req.params.id : "";
  if (!id) { res.status(400).json({ success: false, message: "Invalid raffle ID" }); return null; }
  const raffle = await prisma.raffle.findUnique({ where: { id } });
  if (!raffle || raffle.cancelledAt) { res.status(404).json({ success: false, message: "Raffle not found" }); return null; }
  if (raffle.createdByUserId !== req.userId) { res.status(403).json({ success: false, message: "You do not own this raffle" }); return null; }
  return raffle;
}

router.patch("/:id/discord-promotion", requireAuth, async (req, res, next) => {
  try {
    const raffle = await getOwnedRaffle(req, res);
    if (!raffle) return;

    const enabled = req.body?.enabled === true;
    const channelId = typeof req.body?.channelId === "string" ? req.body.channelId.trim() : "";
    const guildId = typeof req.body?.guildId === "string" ? req.body.guildId.trim() : null;
    const mentionRoleId = typeof req.body?.mentionRoleId === "string" && req.body.mentionRoleId.trim() ? req.body.mentionRoleId.trim() : null;
    const publishNow = req.body?.publishNow === true;

    if (enabled && !channelId) return res.status(400).json({ success: false, message: "channelId is required when Discord promotion is enabled" });
    if (channelId && !/^\d{15,25}$/.test(channelId)) return res.status(400).json({ success: false, message: "Invalid Discord channel ID" });
    if (guildId && !/^\d{15,25}$/.test(guildId)) return res.status(400).json({ success: false, message: "Invalid Discord server ID" });
    if (mentionRoleId && !/^\d{15,25}$/.test(mentionRoleId)) return res.status(400).json({ success: false, message: "Invalid Discord role ID" });

    const currentRules = objectRecord(raffle.entryRules);
    const currentPromotion = readPromotion(raffle.entryRules);
    const promotion: DiscordPromotionConfig = { ...currentPromotion, enabled, channelId: channelId || null, guildId, mentionRoleId };

    if (channelId && env.DISCORD_BOT_TOKEN) await verifyDiscordChannel(channelId, guildId);

    let published = false;
    if (publishNow) {
      if (!enabled || !channelId) return res.status(400).json({ success: false, message: "Enable Discord promotion and choose a channel before publishing" });
      if (currentPromotion.messageId) return res.status(409).json({ success: false, message: "This raffle has already been posted to Discord", promotion: currentPromotion });
      const result = await publishDiscordGiveaway({ channelId, guildId, mentionRoleId, title: raffle.title, description: raffle.description, prizeName: raffle.prizeName, prizeQuantity: raffle.prizeQuantity, winnerCount: raffle.winnerCount, startsAt: raffle.startsAt, endsAt: raffle.endsAt, raffleUrl: raffleUrl(raffle.id) });
      promotion.messageId = result.messageId;
      promotion.postedAt = result.postedAt;
      published = true;
    }

    const updated = await prisma.raffle.update({ where: { id: raffle.id }, data: { entryRules: { ...currentRules, discordPromotion: promotion } }, select: { entryRules: true } });
    return res.json({ success: true, promotion: readPromotion(updated.entryRules), published });
  } catch (error) { next(error); }
});

router.post("/:id/discord-promotion/publish", requireAuth, async (req, res, next) => {
  try {
    const raffle = await getOwnedRaffle(req, res);
    if (!raffle) return;
    const promotion = readPromotion(raffle.entryRules);
    if (!promotion.enabled || !promotion.channelId) return res.status(400).json({ success: false, message: "Discord promotion is not configured for this raffle" });
    if (promotion.messageId) return res.status(409).json({ success: false, message: "This raffle has already been posted to Discord", promotion });
    const result = await publishDiscordGiveaway({ channelId: promotion.channelId, guildId: promotion.guildId, mentionRoleId: promotion.mentionRoleId, title: raffle.title, description: raffle.description, prizeName: raffle.prizeName, prizeQuantity: raffle.prizeQuantity, winnerCount: raffle.winnerCount, startsAt: raffle.startsAt, endsAt: raffle.endsAt, raffleUrl: raffleUrl(raffle.id) });
    const currentRules = objectRecord(raffle.entryRules);
    const updatedPromotion = { ...promotion, messageId: result.messageId, postedAt: result.postedAt };
    const updated = await prisma.raffle.update({ where: { id: raffle.id }, data: { entryRules: { ...currentRules, discordPromotion: updatedPromotion } }, select: { entryRules: true } });
    return res.json({ success: true, promotion: readPromotion(updated.entryRules) });
  } catch (error) { next(error); }
});

router.get("/:id/discord-promotion", requireAuth, async (req, res, next) => {
  try {
    const raffle = await getOwnedRaffle(req, res);
    if (!raffle) return;
    return res.json({ success: true, promotion: readPromotion(raffle.entryRules), botConfigured: Boolean(env.DISCORD_BOT_TOKEN) });
  } catch (error) { next(error); }
});

export default router;
