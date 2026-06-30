import { Router } from "express";
import type { createTenantController } from "../controllers/tenantController";
import { requireAuth } from "../middleware/requireAuth";

export const buildTenantRouter = (
  tenantController: ReturnType<typeof createTenantController>
) => {
  const router = Router();

  router.put("/onboarding", requireAuth, tenantController.updateOnboarding);

  return router;
};
