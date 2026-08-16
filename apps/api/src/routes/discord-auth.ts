import { Router } from "express";
import { verifyAuthToken } from "../services/auth.service.js";
import { connectDiscordAccount, createDiscordAuthorizationUrl } from "../services/discord-oauth.service.js";
import { env } from "../config/env.js";

const router = Router();

function requestToken(req: Parameters<Router["get"]>[1] extends never ? never : any) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length).trim();
  const cookie = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("raven_token="));
  return cookie ? decodeURIComponent(cookie.slice("raven_token=".length)) : null;
}

router.get("/start", async (req, res, next) => {
  try {
    const token = requestToken(req);
    const session = token ? await verifyAuthToken(token) : null;
    return res.json({ success: true, authorizationUrl: createDiscordAuthorizationUrl(session?.id ?? null) });
  } catch (error) { next(error); }
});

router.get("/callback", async (req, res) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const error = typeof req.query.error === "string" ? req.query.error : null;
    if (error) return res.redirect(`${env.WEB_ORIGIN}/account#social=discord&status=error&message=${encodeURIComponent(typeof req.query.error_description === "string" ? req.query.error_description : error)}`);
    if (!code || !state) return res.redirect(`${env.WEB_ORIGIN}/account#social=discord&status=error&message=${encodeURIComponent("Missing Discord OAuth code or state")}`);

    const result = await connectDiscordAccount(code, state);
    const secure = env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `raven_token=${encodeURIComponent(result.authToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);
    const status = result.emailRequired ? "email-required" : "connected";
    return res.redirect(`${env.WEB_ORIGIN}/account#token=${encodeURIComponent(result.authToken)}&social=discord&status=${status}`);
  } catch (error) {
    console.error("Discord OAuth callback failed:", error);
    const message = error instanceof Error ? error.message : "Discord connection failed";
    return res.redirect(`${env.WEB_ORIGIN}/account#social=discord&status=error&message=${encodeURIComponent(message)}`);
  }
});

export default router;
