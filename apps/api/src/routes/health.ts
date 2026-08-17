import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    // Test database connectivity with a simple query
    await prisma.$queryRaw`SELECT 1 as health_check`;
    
    res.json({
      success: true,
      message: "Raven Oracle API is alive",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error) {
    // Service is degraded if database is unreachable
    res.status(503).json({
      success: false,
      message: "Service degraded - database unavailable",
      timestamp: new Date().toISOString(),
      database: "disconnected",
    });
  }
});
