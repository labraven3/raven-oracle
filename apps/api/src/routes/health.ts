import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Raven Oracle API is alive",
    timestamp: new Date().toISOString(),
  });
});
