import type { NextFunction, Request, Response } from "express";
import { requireAuth, requireActiveAccount } from "./auth.js";

/**
 * Raffle mutations are only available to fully active accounts.
 * Public raffle reads remain unaffected.
 * Individual routes still perform their own ownership/authorization checks.
 */
export async function raffleMutationGuard(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  await requireAuth(req, res, async () => {
    await requireActiveAccount(req, res, next);
  });
}
