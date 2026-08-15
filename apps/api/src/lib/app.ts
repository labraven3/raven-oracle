import express from "express";
import { securityMiddleware } from "../middleware/security.js";
import { healthRouter } from "../routes/health.js";

export function createApp() {
  const app = express();

  app.use(securityMiddleware);
  app.use(express.json());

  app.use("/api/health", healthRouter);

  return app;
}
