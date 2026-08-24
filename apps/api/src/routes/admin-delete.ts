import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAdminAuth);

router.delete("/projects/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const project = await prisma.project.findUnique({ where: { id }, select: { id: true, name: true, deletedAt: true } });
    if (!project || project.deletedAt) return res.status(404).json({ success: false, message: "Project not found" });
    const now = new Date();
    await prisma.$transaction(async tx => {
      await tx.raffle.updateMany({ where: { projectId: id, cancelledAt: null, status: { in: ["DRAFT", "SCHEDULED", "ACTIVE", "CLOSED"] } }, data: { status: "CANCELLED", cancelledAt: now } });
      await tx.project.update({ where: { id }, data: { deletedAt: now, status: "ARCHIVED" } });
    });
    return res.json({ success: true, message: `Project "${project.name}" deleted`, projectId: id });
  } catch (error) { next(error); }
});

router.delete("/raffles/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const raffle = await prisma.raffle.findUnique({ where: { id }, select: { id: true, title: true, status: true, cancelledAt: true, _count: { select: { winners: true } } } });
    if (!raffle) return res.status(404).json({ success: false, message: "Raffle not found" });
    if (raffle.status === "COMPLETED" || raffle._count.winners > 0) return res.status(400).json({ success: false, message: "Completed raffles with winners are retained for audit/export." });
    if (raffle.cancelledAt || raffle.status === "CANCELLED") return res.json({ success: true, message: "Raffle already deleted" });
    const updated = await prisma.raffle.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    return res.json({ success: true, message: `Raffle "${raffle.title}" deleted`, raffle: updated });
  } catch (error) { next(error); }
});

export default router;
