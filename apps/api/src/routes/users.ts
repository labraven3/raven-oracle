import { Router } from "express";
import { createUser, getUserById } from "../services/user.service.js";

const router = Router();

router.get("/:id", async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { email, username } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await createUser(email, username);

    return res.status(201).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
