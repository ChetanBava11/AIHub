import { Router } from "express";
import type { createMeController } from "../controllers/meController";
import { requireAuth } from "../middleware/requireAuth";

export const buildMeRouter = (
  meController: ReturnType<typeof createMeController>
) => {
  const router = Router();

  router.get("/", requireAuth, meController.getMe);

  return router;
};
