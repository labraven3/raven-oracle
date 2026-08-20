import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  connectTelegramAccount,
  createTelegramStartToken,
  disconnectTelegramAccount,
  getTelegramAccount,
  telegramBotLink,
  verifyTelegramStartToken,
  sendTelegramMessage,
} from "../services/telegram.service.js";
import { env } from "../config/env.js";

const router = Router();

router.get("/start", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_BOT_USERNAME) {
      return res.status(503).json({ success: false, message: "Telegram connection is not configured" });
    }
    const token = createTelegramStartToken(req.userId);
    return res.json({ success: true, authorizationUrl: telegramBotLink(token) });
  } catch (error) {
    next(error);
  }
});

router.get("/status", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    return res.json({ success: true, account: await getTelegramAccount(req.userId) });
  } catch (error) {
    next(error);
  }
});

router.delete("/disconnect", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    await disconnectTelegramAccount(req.userId);
    return res.json({ success: true, message: "Telegram account disconnected" });
  } catch (error) {
    next(error);
  }
});

router.post("/webhook", async (req, res, next) => {
  try {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return res.sendStatus(404);
    const receivedSecret = req.header("X-Telegram-Bot-Api-Secret-Token");
    if (receivedSecret !== env.TELEGRAM_WEBHOOK_SECRET) return res.sendStatus(401);

    const message = req.body?.message;
    const from = message?.from;
    const text = typeof message?.text === "string" ? message.text : "";
    const match = text.match(/^\/start(?:@[^\s]+)?(?:\s+([A-Za-z0-9_-]+))?/);

    if (!message || !from?.id || !match) return res.sendStatus(200);

    const token = match[1];
    if (!token) {
      await sendTelegramMessage(message.chat?.id ?? from.id, "Open Telegram from your Raven Oracle account and press Connect Telegram to link this account.");
      return res.sendStatus(200);
    }

    try {
      const userId = verifyTelegramStartToken(token);
      await connectTelegramAccount({
        userId,
        telegramUserId: Number(from.id),
        username: typeof from.username === "string" ? from.username : null,
        firstName: typeof from.first_name === "string" ? from.first_name : null,
        lastName: typeof from.last_name === "string" ? from.last_name : null,
      });
      await sendTelegramMessage(message.chat?.id ?? from.id, "Telegram connected successfully to your Raven Oracle account. You can return to your profile now.");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Telegram connection failed";
      await sendTelegramMessage(message.chat?.id ?? from.id, messageText).catch(() => undefined);
    }

    return res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

export default router;
