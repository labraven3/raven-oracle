import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAdminAuth);

router.get("/", async (_req, res, next) => {
  try {
    const rows = await prisma.$queryRaw<Array<{ email: string | null; display_name: string | null; connected_at: Date; updated_at: Date }>>`
      SELECT "email", "display_name", "connected_at", "updated_at"
      FROM "GoogleOAuthConnection"
      ORDER BY "updated_at" DESC
      LIMIT 50
    `;
    const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "GoogleOAuthConnection"
    `;
    return res.json({
      success: true,
      totalConnected: Number(countRows[0]?.count ?? 0n),
      connections: rows.map((row) => ({ email: row.email, name: row.display_name, connectedAt: row.connected_at, updatedAt: row.updated_at })),
    });
  } catch (error) { next(error); }
});

export default router;
