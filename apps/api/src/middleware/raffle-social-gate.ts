import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

/**
 * New raffle entries require both active X and Discord connections.
 * Existing entries/data are never modified by this gate.
 * The response wrapper only marks a newly-created entry as socially verified
 * after the route has accepted it.
 */
export async function raffleSocialGate(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "POST" || !/^\/[^/]+\/entries$/.test(req.path)) return next();
  if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });

  try {
    const accounts = await prisma.socialAccount.findMany({
      where: { userId: req.userId, isActive: true, provider: { in: ["X", "DISCORD"] } },
      select: { provider: true },
    });
    const providers = new Set(accounts.map((account) => account.provider));
    const hasX = providers.has("X");
    const hasDiscord = providers.has("DISCORD");

    if (!hasX || !hasDiscord) {
      const missing = [!hasX ? "X" : null, !hasDiscord ? "Discord" : null].filter(Boolean).join(" and ");
      return res.status(403).json({
        success: false,
        code: "SOCIAL_CONNECTION_REQUIRED",
        message: `Connect both X and Discord before joining this giveaway. Missing: ${missing}.`,
        requirements: { xConnected: hasX, discordConnected: hasDiscord, ready: false },
      });
    }

    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (!body?.success || !body?.entry?.id) return originalJson(body);
      void prisma.raffleEntry.update({
        where: { id: String(body.entry.id) },
        data: { socialVerifiedAtEntry: true },
      }).then(() => originalJson({
        ...body,
        entry: { ...body.entry, socialVerifiedAtEntry: true },
        requirements: { xConnected: true, discordConnected: true, ready: true },
      })).catch((error) => next(error));
      return res;
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
