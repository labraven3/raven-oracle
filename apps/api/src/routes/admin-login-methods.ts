import { Router, type NextFunction, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true, status: true, isAdminApproved: true } });
  if (!user || user.status === "BANNED" || !["ADMIN", "MODERATOR"].includes(user.role) || !user.isAdminApproved) return res.status(403).json({ success: false, message: "Admin access required" });
  next();
}

router.use((req, res, next) => requireAuth(req, res, next, "admin"), requireAdmin);

router.post("/", async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.userIds) ? req.body.userIds.filter((id: unknown): id is string => typeof id === "string") : [];
    if (!ids.length) return res.json({ success: true, methods: {} });
    const logs = await prisma.authAuditLog.findMany({ where: { userId: { in: ids }, event: { in: ["LOGIN_SUCCESS", "OAUTH_LOGIN_SUCCESS"] }, success: true }, orderBy: { createdAt: "desc" }, select: { userId: true, provider: true, event: true, createdAt: true } });
    const methods: Record<string, { provider: string; loggedInAt: string } | null> = {};
    for (const id of ids) methods[id] = null;
    for (const log of logs) if (log.userId && methods[log.userId] === null) methods[log.userId] = { provider: log.provider || (log.event === "LOGIN_SUCCESS" ? "EMAIL" : "OAUTH"), loggedInAt: log.createdAt.toISOString() };
    return res.json({ success: true, methods });
  } catch (error) { next(error); }
});

export default router;
