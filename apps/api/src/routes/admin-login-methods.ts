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

router.post("/", async (req, res) => {
  // Authentication-method history is intentionally unavailable until the
  // canonical audit model is present in the Prisma schema. Return the same
  // stable response shape so the admin UI remains functional.
  const ids = Array.isArray(req.body?.userIds)
    ? req.body.userIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const methods: Record<string, { provider: string; loggedInAt: string } | null> = {};
  for (const id of ids) methods[id] = null;
  return res.json({ success: true, methods });
});

export default router;
