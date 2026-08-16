import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  connectXAccount,
  createXAuthorizationUrl,
} from "../services/x-oauth.service.js";
import { env } from "../config/env.js";

const router = Router();

/**
 * GET /api/auth/x/start
 *
 * Starts X OAuth for the currently authenticated Raven Oracle user.
 */
router.get("/start", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const authorizationUrl = createXAuthorizationUrl(req.userId);

    return res.json({
      success: true,
      authorizationUrl,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/x/callback
 *
 * X redirects here after authorization.
 */
router.get("/callback", async (req, res) => {
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
        typeof req.query.error_description === "string"
          ? req.query.error_description
          : error;

      return res.redirect(
        `${env.WEB_ORIGIN}/?social=x&status=error&message=${encodeURIComponent(reason)}`,
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${env.WEB_ORIGIN}/?social=x&status=error&message=${encodeURIComponent(
          "Missing X OAuth code or state",
        )}`,
      );
    }

    const account = await connectXAccount(
      code,
      state,
    );

    return res.redirect(
      `${env.WEB_ORIGIN}/?social=x&status=connected&account=${encodeURIComponent(
        account.providerUsername ?? account.providerAccountId,
      )}`,
    );
  } catch (error) {
    console.error("X OAuth callback failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "X connection failed";

    return res.redirect(
      `${env.WEB_ORIGIN}/?social=x&status=error&message=${encodeURIComponent(message)}`,
    );
  }
});

export default router;
