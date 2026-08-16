import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  connectDiscordAccount,
  createDiscordAuthorizationUrl,
} from "../services/discord-oauth.service.js";
import { env } from "../config/env.js";

const router = Router();

/**
 * GET /api/auth/discord/start
 */
router.get(
  "/start",
  requireAuth,
  async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const authorizationUrl =
        createDiscordAuthorizationUrl(
          req.userId,
        );

      return res.json({
        success: true,
        authorizationUrl,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/auth/discord/callback
 */
router.get(
  "/callback",
  async (req, res) => {
    try {
      const code =
        typeof req.query.code === "string"
          ? req.query.code
          : null;

      const state =
        typeof req.query.state === "string"
          ? req.query.state
          : null;

      const error =
        typeof req.query.error === "string"
          ? req.query.error
          : null;

      if (error) {
        const reason =
          typeof req.query.error_description ===
          "string"
            ? req.query.error_description
            : error;

        return res.redirect(
          `${env.WEB_ORIGIN}/?social=discord&status=error&message=${encodeURIComponent(reason)}`,
        );
      }

      if (!code || !state) {
        return res.redirect(
          `${env.WEB_ORIGIN}/?social=discord&status=error&message=${encodeURIComponent(
            "Missing Discord OAuth code or state",
          )}`,
        );
      }

      const account =
        await connectDiscordAccount(
          code,
          state,
        );

      return res.redirect(
        `${env.WEB_ORIGIN}/?social=discord&status=connected&account=${encodeURIComponent(
          account.providerUsername ??
            account.providerAccountId,
        )}`,
      );
    } catch (error) {
      console.error(
        "Discord OAuth callback failed:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Discord connection failed";

      return res.redirect(
        `${env.WEB_ORIGIN}/?social=discord&status=error&message=${encodeURIComponent(message)}`,
      );
    }
  },
);

export default router;
