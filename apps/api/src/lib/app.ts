import express from "express";
import { securityMiddleware } from "../middleware/security.js";
import { healthRouter } from "../routes/health.js";
import usersRouter from "../routes/users.js";
import authRouter from "../routes/auth.js";
import profileRouter from "../routes/profile.js";
import socialAccountsRouter from "../routes/social-accounts.js";
import xAuthRouter from "../routes/x-auth.js";
import discordAuthRouter from "../routes/discord-auth.js";
import walletsRouter from "../routes/wallets.js";
import rafflesRouter from "../routes/raffles.js";
import raffleEntriesRouter from "../routes/raffle-entries.js";
import raffleTasksRouter from "../routes/raffle-tasks.js";

export function createApp() {
  const app = express();

  app.use(securityMiddleware);
  app.use(express.json());

  app.use("/api/health", healthRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/social-accounts", socialAccountsRouter);
  app.use("/api/auth/x", xAuthRouter);
  app.use("/api/auth/discord", discordAuthRouter);
  app.use("/api/wallets", walletsRouter);
  app.use("/api/raffles", rafflesRouter);
  app.use("/api/raffles", raffleEntriesRouter);
  app.use("/api/raffles", raffleTasksRouter);

  return app;
}
