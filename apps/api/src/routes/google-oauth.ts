import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { buildGoogleAuthorizationUrl, completeGoogleOAuth, disconnectGoogle, getGoogleConnectionStatus, verifyGoogleOAuthState } from "../services/google-oauth.service.js";

const router = Router();

function redirectToWeb(returnTo: string, key: "google" | "error", value: string) {
  const url = new URL(env.WEB_ORIGIN);
  const safePath = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";
  url.pathname = safePath;
  url.searchParams.set(key, value);
  return url.toString();
}

router.get("/connect", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/dashboard";
    const url = buildGoogleAuthorizationUrl(req.userId, returnTo);
    return res.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google connection is not configured";
    return res.status(503).json({ success: false, message });
  }
});

router.get("/callback", async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  try {
    const { userId, returnTo } = verifyGoogleOAuthState(state);
    if (!code) return res.redirect(redirectToWeb(returnTo, "error", "Google authorization was cancelled."));
    await completeGoogleOAuth(userId, code);
    return res.redirect(redirectToWeb(returnTo, "google", "connected"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google connection failed";
    return res.redirect(redirectToWeb("/dashboard", "error", message));
  }
});

router.get("/status", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    return res.json({ success: true, ...(await getGoogleConnectionStatus(req.userId)) });
  } catch (error) { next(error); }
});

router.post("/disconnect", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    await disconnectGoogle(req.userId);
    return res.json({ success: true, connected: false, message: "Google Drive disconnected." });
  } catch (error) { next(error); }
});

export default router;
