import { Router } from "express";
import { requireAdminAuth } from "../middleware/auth.js";
import { auditWinnerIntegrity } from "../services/winner-integrity.service.js";

const router = Router();
router.use(requireAdminAuth);

router.get("/:raffleId", async (req, res, next) => {
  try {
    const audit = await auditWinnerIntegrity(req.params.raffleId);
    return res.json({ success: true, audit });
  } catch (error) {
    next(error);
  }
});

export default router;
