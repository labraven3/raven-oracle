import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "./auth.js";

/**
 * Raven Oracle raffle entries require both first-party social identities.
 * This is deliberately enforced server-side so the rule cannot be bypassed
 * by calling the entry endpoint directly.
 */
export async function raffleEntrySocialGuard(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "POST" || !req.path.endsWith("/entries")) return next();

  await requireAuth(req, res, async () => {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });

    try {
      const accounts = await prisma.socialAccount.findMany({
        where: { userId: req.userId, isActive: true, provider: { in: ["X", "DISCORD"] } },
        select: { provider: true },
      });

      const hasX = accounts.some((account) => account.provider === "X");
      const hasDiscord = accounts.some((account) => account.provider === "DISCORD");

      if (!hasX || !hasDiscord) {
        return res.status(403).json({
          success: false,
          code: "SOCIAL_CONNECTION_REQUIRED",
          requiresX: !hasX,
          requiresDiscord: !hasDiscord,
          message: !hasX && !hasDiscord
            ? "Connect both X and Discord before joining this giveaway."
            : !hasX
              ? "Connect X before joining this giveaway."
              : "Connect Discord before joining this giveaway.",
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
  });
}
