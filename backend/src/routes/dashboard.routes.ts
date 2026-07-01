import { Router } from "express";
import type { createDashboardController } from "../controllers/dashboardController";
import { requireAuth } from "../middleware/requireAuth";

export const buildDashboardRouter = (
  dashboardController: ReturnType<typeof createDashboardController>
) => {
  const router = Router();

  router.use(requireAuth);
  router.get("/kpis", dashboardController.getKpis);

  return router;
};