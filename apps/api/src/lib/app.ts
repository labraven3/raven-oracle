import express from "express";
import { securityMiddleware } from "../middleware/security.js";
import { raffleMutationGuard } from "../middleware/raffle-mutation-guard.js";
import { projectCatalogGuard } from "../middleware/project-catalog-guard.js";
import { projectApprovalGuard } from "../middleware/project-approval-guard.js";
import { errorHandler, notFoundHandler } from "../middleware/error-handler.js";
import { healthRouter } from "../routes/health.js";
import usersRouter from "../routes/users.js";
import authRouter from "../routes/auth.js";
import adminAuthRouter from "../routes/admin-auth.js";
import profileRouter from "../routes/profile.js";
import socialAccountsRouter from "../routes/social-accounts.js";
import xAuthRouter from "../routes/x-auth.js";
import discordAuthRouter from "../routes/discord-auth.js";
import telegramAuthRouter from "../routes/telegram-auth.js";
import googleOAuthRouter from "../routes/google-oauth.js";
import walletsRouter from "../routes/wallets.js";
import projectsRouter from "../routes/projects.js";
import projectMetadataRouter from "../routes/project-metadata.js";
import projectDiscoveryRouter from "../routes/project-discovery.js";
import projectOnboardingRouter from "../routes/project-onboarding.js";
import projectApprovalRouter from "../routes/project-approval.js";
import chainsRouter from "../routes/chains.js";
import rafflesRouter from "../routes/raffles.js";
import publicRafflesRouter from "../routes/public-raffles.js";
import homeRouter from "../routes/home.js";
import raffleEntriesRouter from "../routes/raffle-entries.js";
import raffleTasksRouter from "../routes/raffle-tasks.js";
import raffleWinnersRouter from "../routes/raffle-winners.js";
import raffleDraftsRouter from "../routes/raffle-drafts.js";
import raffleCaptchaRouter from "../routes/raffle-captcha.js";
import raffleSecurityRouter from "../routes/raffle-security.js";
import alphaRouter from "../routes/alpha.js";
import chatRouter from "../routes/chat.js";
import adminRouter from "../routes/admin.js";
import adminRafflesRouter from "../routes/admin-raffles.js";
import adminRaffleOperationsRouter from "../routes/admin-raffle-operations.js";
import adminRaffleIntegrityRouter from "../routes/admin-raffle-integrity.js";
import adminChainsRouter from "../routes/admin-chains.js";
import adminProjectTypesRouter from "../routes/admin-project-types.js";
import adminProjectChainsRouter from "../routes/admin-project-chains.js";
import adminLoginMethodsRouter from "../routes/admin-login-methods.js";
import adminGoogleIntegrationsRouter from "../routes/admin-google-integrations.js";
import pendingUserCleanupRouter from "../routes/pending-user-cleanup.js";
import raffleXVerifyRouter from "../routes/raffle-x-verify.js";
import raffleHotfixRouter from "../routes/raffle-hotfix.js";
import adminDeleteRouter from "../routes/admin-delete.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Raven Oracle runs behind a single reverse proxy (Nginx/Cloudflare).
  // Trusting that proxy lets rate limiting use the real client IP.
  app.set("trust proxy", 1);
  app.use(securityMiddleware);
  // Raffle data is submitted as small JSON payloads. Keep the parser limit
  // deliberately low so malformed requests cannot consume unnecessary memory.
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/health", healthRouter);

  // Authentication endpoints have their own route-specific brute-force
  // protection in auth.ts. Do NOT put one shared limiter in front of the
  // entire /api/auth tree: OAuth start/callback routes are GET requests and
  // repeated OAuth redirects from X/Discord can otherwise trigger the same
  // login-attempt error even though no password login is happening.
  app.use("/api/users", usersRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/auth/admin", adminAuthRouter);
  app.use("/api/auth/google", googleOAuthRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/social-accounts", socialAccountsRouter);
  app.use("/api/auth/x", xAuthRouter);
  app.use("/api/auth/discord", discordAuthRouter);
  app.use("/api/auth/telegram", telegramAuthRouter);
  app.use("/api/wallets", walletsRouter);
  app.use("/api/home", homeRouter);
  app.use("/api/projects/discovery", projectCatalogGuard, projectDiscoveryRouter);
  app.use("/api/projects/onboarding", projectCatalogGuard, projectOnboardingRouter);
  app.use("/api/raffles", raffleMutationGuard, raffleXVerifyRouter);
  app.use("/api/raffles", raffleMutationGuard, raffleHotfixRouter);
  app.use("/api/projects", raffleHotfixRouter);
  app.use("/api/projects", projectCatalogGuard, projectsRouter);
  app.use("/api/project-metadata", projectMetadataRouter);
  app.use("/api/project-approval", projectApprovalRouter);
  app.use("/api/chains", chainsRouter);
  app.use("/api/raffles/public", publicRafflesRouter);
  app.use("/api/raffles", raffleMutationGuard, rafflesRouter);
  app.use("/api/raffles", raffleMutationGuard, raffleEntriesRouter);
  app.use("/api/raffles", raffleMutationGuard, raffleTasksRouter);
  app.use("/api/raffles", raffleMutationGuard, raffleWinnersRouter);
  app.use("/api/raffle-drafts", raffleDraftsRouter);
  app.use("/api/raffle-captcha", raffleCaptchaRouter);
  app.use("/api/raffle-security", raffleSecurityRouter);
  app.use("/api/alpha", alphaRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/admin", projectApprovalGuard);
  app.use("/api/admin", adminDeleteRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/admin", adminRafflesRouter);
  app.use("/api/admin/raffle-operations", adminRaffleOperationsRouter);
  app.use("/api/admin/raffle-integrity", adminRaffleIntegrityRouter);
  app.use("/api/admin/chains", adminChainsRouter);
  app.use("/api/admin/project-types", adminProjectTypesRouter);
  app.use("/api/admin/project-chains", adminProjectChainsRouter);
  app.use("/api/admin/login-methods", adminLoginMethodsRouter);
  app.use("/api/admin/google-integrations", adminGoogleIntegrationsRouter);
  app.use("/api/admin/pending-users", pendingUserCleanupRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
