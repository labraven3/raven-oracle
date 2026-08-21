import { Router } from "express";
import { getActiveChains } from "../services/chain-config.service.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const chains = await getActiveChains();
    res.json({ success: true, chains });
  } catch (error) {
    next(error);
  }
});

export default router;
