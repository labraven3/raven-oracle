import { Router } from "express";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../middleware/auth.js";
import { simpleRateLimit } from "../middleware/simple-rate-limit.js";

const router = Router();
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set(["api", "admin", "account", "auth", "dashboard", "projects", "raffles", "raffle", "r", "login", "register", "about", "privacy", "terms", "docs", "chat", "alpha"]);
const visitorLimiter = simpleRateLimit({ windowMs: 60_000, max: 120, message: "Too many short-link requests. Please try again shortly." });

function normalizeSlug(value: unknown) {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  if (slug.length < 2 || slug.length > 80 || !SLUG_RE.test(slug) || RESERVED.has(slug)) return null;
  return slug;
}

function visitorHash(req: { ip?: string; headers: Record<string, string | string[] | undefined> }) {
  const ip = req.ip ?? "unknown";
  const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "unknown";
  const salt = process.env.SHORT_LINK_ANALYTICS_SALT ?? process.env.JWT_SECRET ?? "raven-oracle-short-link";
  return crypto.createHash("sha256").update(`${salt}:${ip}:${ua}`).digest("hex");
}

function deviceType(userAgent: string | null) {
  if (!userAgent) return "unknown";
  if (/bot|crawler|spider|preview|slurp/i.test(userAgent)) return "bot";
  if (/mobile|android|iphone|ipad/i.test(userAgent)) return "mobile";
  return "desktop";
}

function publicUrl(slug: string) { return `/r/${encodeURIComponent(slug)}`; }

router.get("/", requireAdminAuth, async (_req, res, next) => {
  try {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(`
      SELECT sl."id", sl."slug", sl."raffleId", sl."active", sl."clickCount", sl."uniqueClickCount", sl."createdAt", sl."updatedAt", sl."lastClickedAt",
             r."title" AS "raffleTitle", r."prizeName", p."name" AS "projectName"
      FROM "RaffleShortLink" sl
      JOIN "Raffle" r ON r."id" = sl."raffleId"
      LEFT JOIN "Project" p ON p."id" = r."projectId"
      ORDER BY sl."createdAt" DESC
      LIMIT 500
    `);
    res.json({ success: true, shortLinks: rows.map((row) => ({ ...row, url: publicUrl(String(row.slug)) })) });
  } catch (error) { next(error); }
});

router.post("/", requireAdminAuth, async (req, res, next) => {
  try {
    const slug = normalizeSlug(req.body?.slug);
    const raffleId = typeof req.body?.raffleId === "string" ? req.body.raffleId : "";
    if (!slug) return res.status(400).json({ success: false, message: "Invalid slug. Use 2-80 lowercase letters, numbers and hyphens." });
    if (!raffleId) return res.status(400).json({ success: false, message: "A raffle is required." });
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found." });
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "RaffleShortLink" WHERE "slug" = ${slug} LIMIT 1`;
    if (existing.length) return res.status(409).json({ success: false, message: "That slug is already in use." });
    const id = crypto.randomUUID();
    await prisma.$executeRaw`INSERT INTO "RaffleShortLink" ("id","slug","raffleId","updatedAt") VALUES (${id}::uuid,${slug},${raffle.id}::uuid,CURRENT_TIMESTAMP)`;
    res.status(201).json({ success: true, shortLink: { id, slug, raffleId: raffle.id, url: publicUrl(slug) } });
  } catch (error) { next(error); }
});

router.patch("/:id", requireAdminAuth, async (req, res, next) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const active = req.body?.active;
    const slug = req.body?.slug === undefined ? undefined : normalizeSlug(req.body.slug);
    if (!id) return res.status(400).json({ success: false, message: "Invalid short-link ID." });
    if (slug === null) return res.status(400).json({ success: false, message: "Invalid slug." });
    if (active !== undefined && typeof active !== "boolean") return res.status(400).json({ success: false, message: "Invalid active value." });
    if (slug === undefined && active === undefined) return res.status(400).json({ success: false, message: "No changes supplied." });
    if (slug !== undefined) {
      const duplicate = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "RaffleShortLink" WHERE "slug" = ${slug} AND "id" <> ${id}::uuid LIMIT 1`;
      if (duplicate.length) return res.status(409).json({ success: false, message: "That slug is already in use." });
    }
    if (slug !== undefined && active !== undefined) await prisma.$executeRaw`UPDATE "RaffleShortLink" SET "slug"=${slug}, "active"=${active}, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}::uuid`;
    else if (slug !== undefined) await prisma.$executeRaw`UPDATE "RaffleShortLink" SET "slug"=${slug}, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}::uuid`;
    else await prisma.$executeRaw`UPDATE "RaffleShortLink" SET "active"=${active}, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}::uuid`;
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.delete("/:id", requireAdminAuth, async (req, res, next) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    await prisma.$executeRaw`DELETE FROM "RaffleShortLink" WHERE "id"=${id}::uuid`;
    res.json({ success: true });
  } catch (error) { next(error); }
});

async function redirectShortLink(req: Parameters<typeof visitorLimiter>[0], res: any, next: any) {
  try {
    const slug = normalizeSlug(req.params.slug);
    if (!slug) return res.status(404).json({ success: false, message: "Short link not found." });
    const rows = await prisma.$queryRaw<Array<{ id: string; raffleId: string }>>`SELECT "id","raffleId" FROM "RaffleShortLink" WHERE "slug"=${slug} AND "active"=true LIMIT 1`;
    const link = rows[0];
    if (!link) return res.status(404).json({ success: false, message: "Short link not found." });
    const referrer = req.get("referer") ?? null;
    const ua = req.get("user-agent") ?? null;
    const hash = visitorHash(req);
    const today = new Date().toISOString().slice(0, 10);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "RaffleShortLink" SET "clickCount"="clickCount"+1,"lastClickedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${link.id}::uuid`;
      await tx.$executeRaw`INSERT INTO "RaffleShortLinkClick" ("id","shortLinkId","referrer","userAgent","deviceType") VALUES (${crypto.randomUUID()}::uuid,${link.id}::uuid,LEFT(${referrer},2048),LEFT(${ua},512),${deviceType(ua)})`;
      const inserted = await tx.$queryRaw<Array<{ id: string }>>`INSERT INTO "RaffleShortLinkVisitor" ("id","shortLinkId","visitorHash","visitedOn") VALUES (${crypto.randomUUID()}::uuid,${link.id}::uuid,${hash},${today}::date) ON CONFLICT ("shortLinkId","visitorHash") DO NOTHING RETURNING "id"`;
      if (inserted.length) await tx.$executeRaw`UPDATE "RaffleShortLink" SET "uniqueClickCount"="uniqueClickCount"+1 WHERE "id"=${link.id}::uuid`;
    });
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return res.redirect(302, `/raffles/${link.raffleId}`);
  } catch (error) { return next(error); }
}

router.get("/:slug", visitorLimiter, redirectShortLink);

export default router;
