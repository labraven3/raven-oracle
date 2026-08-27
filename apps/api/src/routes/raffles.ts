import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { drawRaffle, maybeAutoDrawFcfs } from "../services/raffle-draw.service.js";
import { notifyWinner } from "../services/raffle-winner.service.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
function getRaffleId(req: Request, res: Response): string | null { const id = req.params.id; if (typeof id !== "string") { res.status(400).json({ success: false, message: "Invalid raffle ID" }); return null; } return id; }
function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) { return (req: Request, res: Response, next: NextFunction) => { void handler(req, res, next).catch(next); }; }
const PUBLIC_STATUSES = ["ACTIVE", "SCHEDULED", "CLOSED", "COMPLETED"] as const;

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
    include: { raffle: { include: { project: { select: { id: true, name: true, logoUrl: true, category: true } } } } },
  });
  res.json({ success: true, entries });
}));
router.get("/:id", asyncRoute(async (req, res) => { const raffleId = getRaffleId(req, res); if (!raffleId) return; const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, include: { project: true } }); if (!raffle) { res.status(404).json({ success: false, message: "Raffle not found" }); return; } const now = new Date(); if (raffle.status === "DRAFT" || raffle.status === "CANCELLED") { res.status(404).json({ success: false, message: "Raffle not found" }); return; } if (raffle.status === "SCHEDULED" && now >= raffle.startsAt && now < raffle.endsAt) { await prisma.raffle.update({ where: { id: raffle.id }, data: { status: "ACTIVE" } }); raffle.status = "ACTIVE"; } else if ((raffle.status === "ACTIVE" || raffle.status === "SCHEDULED") && now >= raffle.endsAt) { await prisma.raffle.update({ where: { id: raffle.id }, data: { status: "CLOSED" } }); raffle.status = "CLOSED" } res.setHeader("Cache-Control", "private, max-age=5, stale-while-revalidate=15"); res.json({ success: true, raffle }); }));

router.post("/:id/cancel", requireAuth, asyncRoute(async (req, res) => { if (!req.userId) { res.status(401).json({ success: false, message: "Authentication required" }); return; } const raffleId = getRaffleId(req, res); if (!raffleId) return; const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } }); if (!raffle) { res.status(404).json({ success: false, message: "Raffle not found" }); return; } if (raffle.createdByUserId !== req.userId) { res.status(403).json({ success: false, message: "Only the raffle creator can cancel this raffle" }); return; } if (raffle.cancelledAt) { res.status(400).json({ success: false, message: "Raffle is already cancelled" }); return; } if (["COMPLETED", "DRAWING"].includes(raffle.status)) { res.status(400).json({ success: false, message: "This raffle can no longer be cancelled" }); return; } const cancelled = await prisma.raffle.update({ where: { id: raffle.id }, data: { cancelledAt: new Date(), status: "CANCELLED" } }); res.json({ success: true, raffle: cancelled }); }));
router.delete("/:id", requireAuth, asyncRoute(async (req, res) => { if (!req.userId) { res.status(401).json({ success: false, message: "Authentication required" }); return; } const raffleId = getRaffleId(req, res); if (!raffleId) return; const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } }); if (!raffle) { res.status(404).json({ success: false, message: "Raffle not found" }); return; } if (raffle.createdByUserId !== req.userId) { res.status(403).json({ success: false, message: "Only the raffle creator can delete this raffle" }); return; } if (["COMPLETED", "DRAWING"].includes(raffle.status)) { res.status(400).json({ success: false, message: "Completed raffles with winners cannot be deleted" }); return; } const deleted = await prisma.raffle.update({ where: { id: raffle.id }, data: { status: "CANCELLED", cancelledAt: new Date() } }); res.json({ success: true, raffle: deleted, message: "Raffle deleted." }); }));
router.patch("/:id", requireAuth, async (req, res, next) => { try { const raffleId = req.params.id; if (!raffleId || Array.isArray(raffleId)) return res.status(400).json({ success: false, message: "Invalid raffle ID" }); if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" }); const parsed = req.body?.status; const allowed = ["DRAFT", "SCHEDULED", "ACTIVE", "CLOSED", "CANCELLED"]; if (typeof parsed !== "string" || !allowed.includes(parsed)) return res.status(400).json({ success: false, message: "Invalid creator raffle status transition" }); const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } }); if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" }); if (raffle.createdByUserId !== req.userId) return res.status(403).json({ success: false, message: "Only the raffle creator can update this raffle" }); const requested = parsed as "DRAFT" | "SCHEDULED" | "ACTIVE" | "CLOSED" | "CANCELLED"; const now = new Date(); const transitions: Record<string, string[]> = { DRAFT: ["CANCELLED"], SCHEDULED: ["CANCELLED", "CLOSED"], ACTIVE: ["CANCELLED", "CLOSED"], CLOSED: [], CANCELLED: [] }; if (!transitions[raffle.status]?.includes(requested)) return res.status(400).json({ success: false, message: `Cannot move raffle from ${raffle.status} to ${requested}` }); if (requested === "SCHEDULED" && raffle.startsAt <= now) return res.status(400).json({ success: false, message: "A raffle whose start time has arrived cannot be scheduled" }); if (requested === "ACTIVE" && now >= raffle.endsAt) return res.status(400).json({ success: false, message: "A raffle cannot be activated after its end time" }); if (requested === "CLOSED" && now < raffle.endsAt) return res.status(400).json({ success: false, message: "A raffle can only be closed after its end time" }); const updated = await prisma.raffle.update({ where: { id: raffleId }, data: { status: requested, cancelledAt: requested === "CANCELLED" ? new Date() : raffle.cancelledAt } }); return res.json({ success: true, raffle: updated }); } catch (error) { next(error); } });

router.post("/:id/draw", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const raffleId = getRaffleId(req, res); if (!raffleId) return;
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { createdByUserId: true, status: true, endsAt: true, entryRules: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    if (raffle.createdByUserId !== req.userId) return res.status(403).json({ success: false, message: "Only the raffle creator can draw this raffle" });

    const entryRules = raffle.entryRules && typeof raffle.entryRules === "object" && !Array.isArray(raffle.entryRules) ? raffle.entryRules as Record<string, unknown> : {};
    const isFcfs = entryRules.raffleType === "FCFS";

    // FCFS raffles may finalize as soon as enough eligible spots exist. The
    // same server-side path is used by automatic task verification, so a
    // manual click cannot bypass eligibility or create duplicate winners.
    if (isFcfs && raffle.status === "ACTIVE" && new Date() <= raffle.endsAt) {
      const result = await maybeAutoDrawFcfs(raffleId, req.userId);
      if (!result) return res.status(400).json({ success: false, message: "The FCFS raffle does not have enough eligible entries to finalize winners yet." });
      const notificationResults = await Promise.allSettled(result.winners.map((winner) => notifyWinner(raffleId, winner.id)));
      const notifications = notificationResults.map((item, index) => ({ winnerId: result.winners[index]?.id, sent: item.status === "fulfilled", error: item.status === "rejected" ? (item.reason instanceof Error ? item.reason.message : "Notification failed") : null }));
      return res.json({ success: true, ...result, notifications });
    }

    if (raffle.status !== "CLOSED") return res.status(400).json({ success: false, message: "Raffle entries must be closed before drawing winners" });
    const result = await drawRaffle(raffleId, req.userId, { allowEarlyFcfs: isFcfs });
    const notificationResults = await Promise.allSettled(result.winners.map((winner) => notifyWinner(raffleId, winner.id)));
    const notifications = notificationResults.map((item, index) => ({ winnerId: result.winners[index]?.id, sent: item.status === "fulfilled", error: item.status === "rejected" ? (item.reason instanceof Error ? item.reason.message : "Notification failed") : null }));
    return res.json({ success: true, ...result, notifications });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to draw raffle";
    const known = [
      "Raffle has already been drawn",
      "Cancelled raffle cannot be drawn",
      "Raffle must be closed before drawing winners",
      "Raffle end time has not been reached",
      "Raffle draw is already in progress or is no longer drawable",
      "No eligible entries with payout wallets available",
    ];
    if (known.includes(message) || /^Raffle has \d+ unevaluated entr/.test(message)) {
      return res.status(message === "Raffle has already been drawn" ? 409 : 400).json({ success: false, message });
    }
    return next(error);
  }
});
router.post("/:id/winners/:winnerId/notify", requireAuth, async (req, res, next) => { try { if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" }); const raffleId = getRaffleId(req, res); if (!raffleId) return; const winnerId = Array.isArray(req.params.winnerId) ? req.params.winnerId[0] : req.params.winnerId; if (!winnerId) return res.status(400).json({ success: false, message: "Invalid winner ID" }); const winner = await prisma.raffleWinner.findUnique({ where: { id: winnerId } }); if (!winner || winner.raffleId !== raffleId) return res.status(404).json({ success: false, message: "Raffle winner not found" }); const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { createdByUserId: true } }); if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" }); if (raffle.createdByUserId !== req.userId) return res.status(403).json({ success: false, message: "Only the raffle creator can notify winners" }); const updated = await notifyWinner(raffleId, winnerId); return res.json({ success: true, winner: updated }); } catch (error) { next(error); } });

export default router;
