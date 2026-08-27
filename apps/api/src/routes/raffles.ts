import { Router, type Request, type Response, type NextFunction } from "express";
import { createRequire } from "node:module";
import { prisma } from "../lib/prisma.js";
import { drawRaffle } from "../services/raffle-draw.service.js";
import { notifyWinner } from "../services/raffle-winner.service.js";
import { requireAuth } from "../middleware/auth.js";

const require = createRequire(import.meta.url);
const xlsx = require("node-xlsx") as { build: (worksheets: Array<{ name: string; data: unknown[][] }>, options?: unknown) => Buffer };

const router = Router();
function getRaffleId(req: Request, res: Response): string | null { const id = req.params.id; if (typeof id !== "string") { res.status(400).json({ success: false, message: "Invalid raffle ID" }); return null; } return id; }
function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) { return (req: Request, res: Response, next: NextFunction) => { void handler(req, res, next).catch(next); }; }
const PUBLIC_STATUSES = ["ACTIVE", "SCHEDULED", "CLOSED", "COMPLETED"] as const;

type XlsxTextCell = { v: string; t: "s"; s: { numFmt: "@" } };
const textCell = (value: unknown): XlsxTextCell => ({ v: String(value ?? ""), t: "s", s: { numFmt: "@" } });

router.post("/", asyncRoute(async (_req, res) => { res.status(410).json({ success: false, message: "Raffles are created from the owning project dashboard." }); }));
router.get("/", asyncRoute(async (req, res) => {
  const requested = typeof req.query.status === "string" ? req.query.status : undefined;
  const status = requested && PUBLIC_STATUSES.includes(requested as (typeof PUBLIC_STATUSES)[number]) ? requested : undefined;
  const where = status ? { status: status as never, cancelledAt: null } : { status: { in: [...PUBLIC_STATUSES] as never[] }, cancelledAt: null };
  const raffles = await prisma.raffle.findMany({ where, orderBy: { startsAt: "desc" }, take: 60, select: { id: true, title: true, description: true, prizeName: true, prizeQuantity: true, startsAt: true, endsAt: true, status: true, winnerCount: true, entryRules: true, project: { select: { id: true, name: true, logoUrl: true, category: true } }, _count: { select: { entries: true, winners: true, tasks: true } } } });
  res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
  res.json({ success: true, raffles });
}));
router.get("/mine", requireAuth, asyncRoute(async (req, res) => {
  if (!req.userId) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }

  const entries = await prisma.raffleEntry.findMany({
    where: { userId: req.userId },
    orderBy: { enteredAt: "desc" },
    take: 100,
    include: {
      raffle: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              category: true,
            },
          },
        },
      },
    },
  });

  res.json({ success: true, entries });
}));
router.get("/:id", asyncRoute(async (req, res) => { const raffleId = getRaffleId(req, res); if (!raffleId) return; const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, include: { project: true } }); if (!raffle) { res.status(404).json({ success: false, message: "Raffle not found" }); return; } const now = new Date(); if (raffle.status === "DRAFT" || raffle.status === "CANCELLED") { res.status(404).json({ success: false, message: "Raffle not found" }); return; } if (raffle.status === "SCHEDULED" && now >= raffle.startsAt && now < raffle.endsAt) { await prisma.raffle.update({ where: { id: raffle.id }, data: { status: "ACTIVE" } }); raffle.status = "ACTIVE"; } else if ((raffle.status === "ACTIVE" || raffle.status === "SCHEDULED") && now >= raffle.endsAt) { await prisma.raffle.update({ where: { id: raffle.id }, data: { status: "CLOSED" } }); raffle.status = "CLOSED" } res.setHeader("Cache-Control", "private, max-age=5, stale-while-revalidate=15"); res.json({ success: true, raffle }); }));

router.get("/:id/winners/export", requireAuth, asyncRoute(async (req, res) => {
  if (!req.userId) { res.status(401).json({ success: false, message: "Authentication required" }); return; }
  const raffleId = getRaffleId(req, res); if (!raffleId) return;
  const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, title: true, createdByUserId: true, status: true } });
  if (!raffle) { res.status(404).json({ success: false, message: "Raffle not found" }); return; }
  if (raffle.createdByUserId !== req.userId) { res.status(403).json({ success: false, message: "Only the raffle host can export winners" }); return; }
  if (raffle.status !== "COMPLETED") { res.status(400).json({ success: false, message: "Winners can be exported after the raffle is completed" }); return; }

  const winners = await prisma.raffleWinner.findMany({
    where: { raffleId: raffle.id },
    orderBy: { selectionRank: "asc" },
    select: {
      walletAddressSnapshot: true,
      user: { select: { socialAccounts: { where: { provider: { in: ["X", "DISCORD"] }, isActive: true }, select: { provider: true, providerUsername: true, displayName: true } } } },
    },
  });

  // Export only the host-facing winner fields. Every value is an XLSX text cell
  // so long wallet addresses remain intact in Excel.
  const rows: unknown[][] = [
    [textCell("X"), textCell("Discord"), textCell("Wallet Address")],
    ...winners.map((winner) => {
      const x = winner.user.socialAccounts.find((account) => account.provider === "X");
      const discord = winner.user.socialAccounts.find((account) => account.provider === "DISCORD");
      return [
        textCell(x?.providerUsername ?? x?.displayName ?? ""),
        textCell(discord?.providerUsername ?? discord?.displayName ?? ""),
        textCell(winner.walletAddressSnapshot),
      ];
    }),
  ];

  const workbook = xlsx.build(
    [{ name: "Winners", data: rows }],
    { sheetOptions: { "!cols": [{ wch: 28 }, { wch: 28 }, { wch: 48 }] } },
  );
  const filename = `raven-oracle-${raffle.id}-winners.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(workbook);
}));

router.post("/:id/cancel", requireAuth, asyncRoute(async (req, res) => { if (!req.userId) { res.status(401).json({ success: false, message: "Authentication required" }); return; } const raffleId = getRaffleId(req, res); if (!raffleId) return; const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } }); if (!raffle) { res.status(404).json({ success: false, message: "Raffle not found" }); return; } if (raffle.createdByUserId !== req.userId) { res.status(403).json({ success: false, message: "Only the raffle creator can cancel this raffle" }); return; } if (raffle.cancelledAt) { res.status(400).json({ success: false, message: "Raffle is already cancelled" }); return; } if (["COMPLETED", "DRAWING"].includes(raffle.status)) { res.status(400).json({ success: false, message: "This raffle can no longer be cancelled" }); return; } const cancelled = await prisma.raffle.update({ where: { id: raffle.id }, data: { cancelledAt: new Date(), status: "CANCELLED" } }); res.json({ success: true, raffle: cancelled }); }));
router.delete("/:id", requireAuth, asyncRoute(async (req, res) => { if (!req.userId) { res.status(401).json({ success: false, message: "Authentication required" }); return; } const raffleId = getRaffleId(req, res); if (!raffleId) return; const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } }); if (!raffle) { res.status(404).json({ success: false, message: "Raffle not found" }); return; } if (raffle.createdByUserId !== req.userId) { res.status(403).json({ success: false, message: "Only the raffle creator can delete this raffle" }); return; } if (["COMPLETED", "DRAWING"].includes(raffle.status)) { res.status(400).json({ success: false, message: "Completed raffles with winners cannot be deleted" }); return; } const deleted = await prisma.raffle.update({ where: { id: raffle.id }, data: { status: "CANCELLED", cancelledAt: new Date() } }); res.json({ success: true, raffle: deleted, message: "Raffle deleted." }); }));
router.patch("/:id", requireAuth, async (req, res, next) => { try { const raffleId = req.params.id; if (!raffleId || Array.isArray(raffleId)) return res.status(400).json({ success: false, message: "Invalid raffle ID" }); if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" }); const parsed = req.body?.status; const allowed = ["DRAFT", "SCHEDULED", "ACTIVE", "CLOSED", "CANCELLED"]; if (typeof parsed !== "string" || !allowed.includes(parsed)) return res.status(400).json({ success: false, message: "Invalid creator raffle status transition" }); const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } }); if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" }); if (raffle.createdByUserId !== req.userId) return res.status(403).json({ success: false, message: "Only the raffle creator can update this raffle" }); const requested = parsed as "DRAFT" | "SCHEDULED" | "ACTIVE" | "CLOSED" | "CANCELLED"; const now = new Date(); const transitions: Record<string, string[]> = { DRAFT: ["CANCELLED"], SCHEDULED: ["CANCELLED", "CLOSED"], ACTIVE: ["CANCELLED", "CLOSED"], CLOSED: [], CANCELLED: [] }; if (!transitions[raffle.status]?.includes(requested)) return res.status(400).json({ success: false, message: `Cannot move raffle from ${raffle.status} to ${requested}` }); if (requested === "SCHEDULED" && raffle.startsAt <= now) return res.status(400).json({ success: false, message: "A raffle whose start time has arrived cannot be scheduled" }); if (requested === "ACTIVE" && now >= raffle.endsAt) return res.status(400).json({ success: false, message: "A raffle cannot be activated after its end time" }); if (requested === "CLOSED" && now < raffle.endsAt) return res.status(400).json({ success: false, message: "A raffle can only be closed after its end time" }); const updated = await prisma.raffle.update({ where: { id: raffleId }, data: { status: requested, cancelledAt: requested === "CANCELLED" ? new Date() : raffle.cancelledAt } }); return res.json({ success: true, raffle: updated }); } catch (error) { next(error); } });
router.post("/:id/draw", requireAuth, async (req, res, next) => { try { if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" }); const raffleId = getRaffleId(req, res); if (!raffleId) return; const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { createdByUserId: true, status: true, endsAt: true } }); if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" }); if (raffle.createdByUserId !== req.userId) return res.status(403).json({ success: false, message: "Only the raffle creator can draw this raffle" }); if (raffle.status !== "CLOSED") return res.status(400).json({ success: false, message: "Raffle entries must be closed before drawing winners" }); if (new Date() < raffle.endsAt) return res.status(400).json({ success: false, message: "Raffle cannot be drawn before its end time" }); const result = await drawRaffle(raffleId, req.userId); const notificationResults = await Promise.allSettled(result.winners.map((winner) => notifyWinner(raffleId, winner.id))); const notifications = notificationResults.map((item, index) => ({ winnerId: result.winners[index]?.id, sent: item.status === "fulfilled", error: item.status === "rejected" ? (item.reason instanceof Error ? item.reason.message : "Notification failed") : null })); return res.json({ success: true, ...result, notifications }); } catch (error) { next(error); } });
router.post("/:id/winners/:winnerId/notify", requireAuth, async (req, res, next) => { try { if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" }); const raffleId = getRaffleId(req, res); if (!raffleId) return; const winnerId = Array.isArray(req.params.winnerId) ? req.params.winnerId[0] : req.params.winnerId; if (!winnerId) return res.status(400).json({ success: false, message: "Invalid winner ID" }); const winner = await prisma.raffleWinner.findUnique({ where: { id: winnerId } }); if (!winner || winner.raffleId !== raffleId) return res.status(404).json({ success: false, message: "Raffle winner not found" }); const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { createdByUserId: true } }); if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" }); if (raffle.createdByUserId !== req.userId) return res.status(403).json({ success: false, message: "Only the raffle creator can notify winners" }); const updated = await notifyWinner(raffleId, winnerId); return res.json({ success: true, winner: updated }); } catch (error) { next(error); } });

export default router;
