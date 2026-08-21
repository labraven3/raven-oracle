import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { evaluateRaffleEntry } from "../services/eligibility.service.js";
import { drawRaffle } from "../services/raffle-draw.service.js";
import { notifyWinner } from "../services/raffle-winner.service.js";
import { requireAdminAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAdminAuth);

router.get("/", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const type = typeof req.query.projectType === "string" ? req.query.projectType : undefined;
    const where = status && ["DRAFT","SCHEDULED","ACTIVE","CLOSED","DRAWING","COMPLETED","CANCELLED"].includes(status)
      ? { status: status as never }
      : {};
    const raffles = await prisma.raffle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        project: { select: { id: true, name: true, logoUrl: true, category: true } },
        createdBy: { select: { username: true, email: true } },
        _count: { select: { entries: true, winners: true, tasks: true } },
      },
    });
    let projectTypeById = new Map<string, string>();
    if (type) {
      const ids = raffles.map((r) => r.projectId).filter((id): id is string => Boolean(id));
      if (ids.length) {
        const rows = await prisma.$queryRaw<Array<{ projectId: string; type: string }>>`
          SELECT "projectId", "type" FROM "ProjectClassification"
          WHERE "projectId" IN (${ids.map((id) => `${id}`).join(",")})
        `;
        projectTypeById = new Map(rows.map((row) => [row.projectId, row.type]));
      }
    }
    const filtered = type ? raffles.filter((r) => projectTypeById.get(r.projectId ?? "") === type) : raffles;
    return res.json({ success: true, raffles: filtered, projectTypes: Object.fromEntries(projectTypeById) });
  } catch (error) { next(error); }
});

router.post("/:raffleId/evaluate", async (req, res, next) => {
  try {
    const raffle = await prisma.raffle.findUnique({ where: { id: req.params.raffleId }, select: { id: true, status: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    if (!["CLOSED", "DRAWING"].includes(raffle.status)) return res.status(400).json({ success: false, message: "Raffle must be closed before evaluation" });
    const entries = await prisma.raffleEntry.findMany({ where: { raffleId: raffle.id, status: { not: "INELIGIBLE" } }, select: { id: true } });
    let evaluated = 0;
    for (const entry of entries) { await evaluateRaffleEntry(entry.id); evaluated += 1; }
    const summary = await prisma.raffleEntry.groupBy({ by: ["status"], where: { raffleId: raffle.id }, _count: { _all: true } });
    return res.json({ success: true, evaluated, summary });
  } catch (error) { next(error); }
});

router.post("/:raffleId/draw", async (req, res, next) => {
  try {
    const raffle = await prisma.raffle.findUnique({ where: { id: req.params.raffleId }, select: { id: true, status: true, endsAt: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    if (raffle.status !== "CLOSED") return res.status(400).json({ success: false, message: "Raffle must be CLOSED before drawing" });
    if (new Date() < raffle.endsAt) return res.status(400).json({ success: false, message: "Raffle end time has not arrived" });
    const result = await drawRaffle(raffle.id, req.userId!);
    const notifications = await Promise.allSettled(result.winners.map((winner) => notifyWinner(raffle.id, winner.id)));
    return res.json({ success: true, result, notifications: notifications.map((n, i) => ({ winnerId: result.winners[i]?.id, sent: n.status === "fulfilled" })) });
  } catch (error) { next(error); }
});

router.get("/:raffleId/summary", async (req, res, next) => {
  try {
    const raffle = await prisma.raffle.findUnique({ where: { id: req.params.raffleId }, select: { id: true, title: true, status: true, winnerCount: true, prizeName: true } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    const [entries, winners] = await Promise.all([
      prisma.raffleEntry.groupBy({ by: ["status"], where: { raffleId: raffle.id }, _count: { _all: true } }),
      prisma.raffleWinner.findMany({ where: { raffleId: raffle.id }, orderBy: { selectionRank: "asc" }, select: { id: true, selectionRank: true, status: true, notificationStatus: true, walletAddressSnapshot: true, selectedAt: true, notifiedAt: true, user: { select: { username: true, displayName: true, email: true } } } }),
    ]);
    return res.json({ success: true, raffle, entries, winners });
  } catch (error) { next(error); }
});

export default router;
