import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../middleware/auth.js";
import { simpleRateLimit } from "../middleware/simple-rate-limit.js";

const router = Router();
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set(["api", "admin", "account", "auth", "dashboard", "projects", "raffles", "raffle", "r", "login", "register", "about", "privacy", "terms", "docs", "chat", "alpha"]);
const visitorLimiter = simpleRateLimit({ windowMs: 60_000, max: 120, message: "Too many short-link requests. Please try again shortly." });
let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

function normalizeSlug(value: unknown) {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  if (slug.length < 2 || slug.length > 80 || !SLUG_RE.test(slug) || RESERVED.has(slug)) return null;
  return slug;
}

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "raffle"; }

async function ensureSchema() {
  if (schemaReady) return;
  schemaPromise ??= prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RaffleShortLink" (
      "id" UUID NOT NULL, "slug" VARCHAR(80) NOT NULL, "raffleId" UUID NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
      "clickCount" INTEGER NOT NULL DEFAULT 0, "uniqueClickCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "lastClickedAt" TIMESTAMP(3),
      CONSTRAINT "RaffleShortLink_pkey" PRIMARY KEY ("id"), CONSTRAINT "RaffleShortLink_slug_key" UNIQUE ("slug"),
      CONSTRAINT "RaffleShortLink_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "RaffleShortLink_raffleId_idx" ON "RaffleShortLink"("raffleId");
    CREATE INDEX IF NOT EXISTS "RaffleShortLink_active_idx" ON "RaffleShortLink"("active");
    CREATE TABLE IF NOT EXISTS "RaffleShortLinkVisitor" (
      "id" UUID NOT NULL, "shortLinkId" UUID NOT NULL, "visitorHash" VARCHAR(64) NOT NULL, "visitedOn" DATE NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RaffleShortLinkVisitor_pkey" PRIMARY KEY ("id"), CONSTRAINT "RaffleShortLinkVisitor_shortLinkId_visitorHash_key" UNIQUE ("shortLinkId", "visitorHash"),
      CONSTRAINT "RaffleShortLinkVisitor_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "RaffleShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "RaffleShortLinkVisitor_shortLinkId_idx" ON "RaffleShortLinkVisitor"("shortLinkId");
    CREATE TABLE IF NOT EXISTS "RaffleShortLinkClick" (
      "id" UUID NOT NULL, "shortLinkId" UUID NOT NULL, "referrer" TEXT, "userAgent" TEXT, "deviceType" VARCHAR(16), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RaffleShortLinkClick_pkey" PRIMARY KEY ("id"), CONSTRAINT "RaffleShortLinkClick_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "RaffleShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "RaffleShortLinkClick_shortLinkId_createdAt_idx" ON "RaffleShortLinkClick"("shortLinkId", "createdAt");
  `).then(() => { schemaReady = true; }).catch((error) => { schemaPromise = null; throw error; });
  await schemaPromise;
}

async function ensureRaffleShortLink(raffleId: string, title: string) {
  await ensureSchema();
  const existing = await prisma.$queryRaw<Array<{ id: string; slug: string }>>`SELECT "id","slug" FROM "RaffleShortLink" WHERE "raffleId"=${raffleId}::uuid LIMIT 1`;
  if (existing[0]) return { ...existing[0], url: `/r/${encodeURIComponent(existing[0].slug)}` };
  const base = slugify(title); let slug = base; let suffix = 2;
  while (true) {
    const collision = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "RaffleShortLink" WHERE "slug"=${slug} LIMIT 1`;
    if (!collision.length) break; slug = `${base}-${suffix++}`;
  }
  const id = crypto.randomUUID();
  await prisma.$executeRaw`INSERT INTO "RaffleShortLink" ("id","slug","raffleId","updatedAt") VALUES (${id}::uuid,${slug},${raffleId}::uuid,CURRENT_TIMESTAMP)`;
  return { id, slug, url: `/r/${encodeURIComponent(slug)}` };
}

export async function autoRaffleShortLink(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "POST" || !req.path.endsWith("/raffles")) return next();
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (!body?.success || !body?.raffle?.id || !body?.raffle?.title) return originalJson(body);
    void ensureRaffleShortLink(String(body.raffle.id), String(body.raffle.title))
      .then((shortLink) => originalJson({ ...body, raffle: { ...body.raffle, shortLink } }))
      .catch(next);
    return res;
  };
  next();
}

router.get("/", requireAdminAuth, async (_req, res, next) => {
  try {
    await ensureSchema();
    // Backfill links for older raffles once, so this page is never empty just because
    // the short-link feature was added after those raffles were created.
    const raffles = await prisma.raffle.findMany({ where: { status: { not: "CANCELLED" } }, select: { id: true, title: true }, orderBy: { startsAt: "desc" }, take: 500 });
    await Promise.all(raffles.map((raffle) => ensureRaffleShortLink(raffle.id, raffle.title)));
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(`
      SELECT sl."id", sl."slug", sl."raffleId", sl."active", sl."clickCount", sl."uniqueClickCount", sl."createdAt", sl."updatedAt", sl."lastClickedAt",
             r."title" AS "raffleTitle", r."prizeName", p."name" AS "projectName"
      FROM "RaffleShortLink" sl JOIN "Raffle" r ON r."id" = sl."raffleId" LEFT JOIN "Project" p ON p."id" = r."projectId"
      ORDER BY sl."createdAt" DESC LIMIT 500
    `);
    res.json({ success: true, shortLinks: rows.map((row) => ({ ...row, url: `/r/${encodeURIComponent(String(row.slug))}` })) });
  } catch (error) { next(error); }
});

router.post("/", requireAdminAuth, async (req, res, next) => {
  try {
    const slug = normalizeSlug(req.body?.slug); const raffleId = typeof req.body?.raffleId === "string" ? req.body.raffleId : "";
    if (!slug) return res.status(400).json({ success: false, message: "Invalid slug. Use 2-80 lowercase letters, numbers and hyphens." });
    if (!raffleId) return res.status(400).json({ success: false, message: "A raffle is required." });
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found." });
    await ensureSchema();
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "RaffleShortLink" WHERE "slug"=${slug} LIMIT 1`;
    if (existing.length) return res.status(409).json({ success: false, message: "That slug is already in use." });
    const id = crypto.randomUUID();
    await prisma.$executeRaw`INSERT INTO "RaffleShortLink" ("id","slug","raffleId","updatedAt") VALUES (${id}::uuid,${slug},${raffle.id}::uuid,CURRENT_TIMESTAMP)`;
    res.status(201).json({ success: true, shortLink: { id, slug, raffleId: raffle.id, url: `/r/${encodeURIComponent(slug)}` } });
  } catch (error) { next(error); }
});

router.patch("/:id", requireAdminAuth, async (req, res, next) => {
  try {
    await ensureSchema(); const id = typeof req.params.id === "string" ? req.params.id : ""; const active = req.body?.active; const slug = req.body?.slug === undefined ? undefined : normalizeSlug(req.body.slug);
    if (!id) return res.status(400).json({ success: false, message: "Invalid short-link ID." });
    if (slug === null) return res.status(400).json({ success: false, message: "Invalid slug." });
    if (active !== undefined && typeof active !== "boolean") return res.status(400).json({ success: false, message: "Invalid active value." });
    if (slug === undefined && active === undefined) return res.status(400).json({ success: false, message: "No changes supplied." });
    if (slug !== undefined) { const duplicate = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "RaffleShortLink" WHERE "slug"=${slug} AND "id"<>${id}::uuid LIMIT 1`; if (duplicate.length) return res.status(409).json({ success: false, message: "That slug is already in use." }); }
    if (slug !== undefined && active !== undefined) await prisma.$executeRaw`UPDATE "RaffleShortLink" SET "slug"=${slug},"active"=${active},"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}::uuid`;
    else if (slug !== undefined) await prisma.$executeRaw`UPDATE "RaffleShortLink" SET "slug"=${slug},"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}::uuid`;
    else await prisma.$executeRaw`UPDATE "RaffleShortLink" SET "active"=${active},"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}::uuid`;
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.delete("/:id", requireAdminAuth, async (req, res, next) => { try { await ensureSchema(); const id = typeof req.params.id === "string" ? req.params.id : ""; await prisma.$executeRaw`DELETE FROM "RaffleShortLink" WHERE "id"=${id}::uuid`; res.json({ success: true }); } catch (error) { next(error); } });

async function redirectShortLink(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureSchema(); const slug = normalizeSlug(req.params.slug); if (!slug) return res.status(404).json({ success: false, message: "Short link not found." });
    const rows = await prisma.$queryRaw<Array<{ id: string; raffleId: string }>>`SELECT "id","raffleId" FROM "RaffleShortLink" WHERE "slug"=${slug} AND "active"=true LIMIT 1`; const link = rows[0];
    if (!link) return res.status(404).json({ success: false, message: "Short link not found." });
    const referrer = req.get("referer") ?? null; const ua = req.get("user-agent") ?? null; const ip = req.ip ?? "unknown"; const salt = process.env.SHORT_LINK_ANALYTICS_SALT ?? process.env.JWT_SECRET ?? "raven-oracle-short-link"; const hash = crypto.createHash("sha256").update(`${salt}:${ip}:${ua ?? "unknown"}`).digest("hex");
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "RaffleShortLink" SET "clickCount"="clickCount"+1,"lastClickedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${link.id}::uuid`;
      const device = /bot|crawler|spider|preview/i.test(ua ?? "") ? "bot" : /mobile|android|iphone|ipad/i.test(ua ?? "") ? "mobile" : "desktop";
      await tx.$executeRaw`INSERT INTO "RaffleShortLinkClick" ("id","shortLinkId","referrer","userAgent","deviceType") VALUES (${crypto.randomUUID()}::uuid,${link.id}::uuid,LEFT(${referrer},2048),LEFT(${ua},512),${device})`;
      const inserted = await tx.$queryRaw<Array<{ id: string }>>`INSERT INTO "RaffleShortLinkVisitor" ("id","shortLinkId","visitorHash","visitedOn") VALUES (${crypto.randomUUID()}::uuid,${link.id}::uuid,${hash},CURRENT_DATE) ON CONFLICT ("shortLinkId","visitorHash") DO NOTHING RETURNING "id"`;
      if (inserted.length) await tx.$executeRaw`UPDATE "RaffleShortLink" SET "uniqueClickCount"="uniqueClickCount"+1 WHERE "id"=${link.id}::uuid`;
    });
    res.set("Cache-Control", "no-store"); res.set("X-Robots-Tag", "noindex, nofollow, noarchive"); return res.redirect(302, `/raffles/${link.raffleId}`);
  } catch (error) { return next(error); }
}

router.get("/:slug", visitorLimiter, redirectShortLink);
export default router;
