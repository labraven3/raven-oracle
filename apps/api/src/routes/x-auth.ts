import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { connectXAccount, createXAuthorizationUrl } from "../services/x-oauth.service.js";
import { env } from "../config/env.js";
import { logOAuthLoginSuccess, logOAuthLoginFailed } from "../services/auth-audit.service.js";

const router = Router();

router.get("/start", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    return res.json({ success: true, authorizationUrl: createXAuthorizationUrl(req.userId) });
  } catch (error) { next(error); }
});

router.get("/callback", async (req, res) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const error = typeof req.query.error === "string" ? req.query.error : null;
    if (error) {
      const reason = typeof req.query.error_description === "string" ? req.query.error_description : error;
      logOAuthLoginFailed("X", reason, req).catch(console.error);
      return res.redirect(`${env.WEB_ORIGIN}/account#social=x&status=error&message=${encodeURIComponent(reason)}`);
    }
    if (!code || !state) {
      logOAuthLoginFailed("X", "Missing code or state", req).catch(console.error);
      return res.redirect(`${env.WEB_ORIGIN}/account#social=x&status=error&message=${encodeURIComponent("Missing X OAuth code or state")}`);
    }
    const account = await connectXAccount(code, state);
    logOAuthLoginSuccess(account.userId, "X", req).catch(console.error);
    return res.redirect(`${env.WEB_ORIGIN}/account#social=x&status=connected&account=${encodeURIComponent(account.providerUsername ?? account.providerAccountId)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "X connection failed";
    logOAuthLoginFailed("X", message, req).catch(console.error);
    return res.redirect(`${env.WEB_ORIGIN}/account#social=x&status=error&message=${encodeURIComponent(message)}`);
  }
});

export default router;
