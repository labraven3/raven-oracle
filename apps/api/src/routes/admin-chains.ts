import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ensureChainStore, getAllChains, slugify } from "../services/chain-config.service.js";

const router = Router();

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

router.get("/", async (_req, res, next) => {
  try {
    const chains = await getAllChains();
    res.json({ success: true, chains });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    await ensureChainStore();
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid chain data" });
    const slug = slugify(parsed.data.name);
    if (!slug) return res.status(400).json({ success: false, message: "Invalid chain name" });
    const existing = await prisma.$queryRawUnsafe<Array<{ id: string; isActive: boolean }>>(
      `SELECT "id", "isActive" FROM "ChainConfig" WHERE LOWER("name") = LOWER($1) OR "slug" = $2 LIMIT 1`,
      parsed.data.name,
      slug,
    );
    if (existing[0]) return res.status(409).json({ success: false, message: "That chain already exists" });
    const maxRows = await prisma.$queryRawUnsafe<Array<{ max: number | null }>>(`SELECT MAX("sortOrder")::int AS max FROM "ChainConfig"`);
    const sortOrder = parsed.data.sortOrder ?? Number(maxRows[0]?.max ?? -1) + 1;
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; slug: string; isActive: boolean; sortOrder: number }>>(
      `INSERT INTO "ChainConfig" ("id", "name", "slug", "isActive", "sortOrder") VALUES (gen_random_uuid()::text, $1, $2, TRUE, $3) RETURNING "id", "name", "slug", "isActive", "sortOrder"`,
      parsed.data.name,
      slug,
      sortOrder,
    );
    res.status(201).json({ success: true, chain: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    await ensureChainStore();
    const parsed = z.object({ isActive: z.boolean().optional(), sortOrder: z.number().int().min(0).max(10000).optional(), name: z.string().trim().min(1).max(80).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid chain update" });
    const sets: string[] = [];
    const values: unknown[] = [];
    let index = 1;
    if (parsed.data.name !== undefined) { sets.push(`"name" = $${index++}`); values.push(parsed.data.name); }
    if (parsed.data.isActive !== undefined) { sets.push(`"isActive" = $${index++}`); values.push(parsed.data.isActive); }
    if (parsed.data.sortOrder !== undefined) { sets.push(`"sortOrder" = $${index++}`); values.push(parsed.data.sortOrder); }
    sets.push(`"updatedAt" = CURRENT_TIMESTAMP`);
    values.push(req.params.id);
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; slug: string; isActive: boolean; sortOrder: number }>>(
      `UPDATE "ChainConfig" SET ${sets.join(", ")} WHERE "id" = $${index} RETURNING "id", "name", "slug", "isActive", "sortOrder"`,
      ...values,
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: "Chain not found" });
    res.json({ success: true, chain: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await ensureChainStore();
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`DELETE FROM "ChainConfig" WHERE "id" = $1 RETURNING "id"`, req.params.id);
    if (!rows[0]) return res.status(404).json({ success: false, message: "Chain not found" });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
