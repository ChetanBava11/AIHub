import { Router } from "express";
import type { createOpportunityController } from "../controllers/opportunityController";
import { requireAuth } from "../middleware/requireAuth";

export const buildOpportunityRouter = (
  opportunityController: ReturnType<typeof createOpportunityController>
) => {
  const router = Router();

  router.use(requireAuth);
  router.get("/", opportunityController.listOpportunities);
  router.post("/", opportunityController.createOpportunity);
  router.get("/:id", opportunityController.getOpportunity);
  router.put("/:id", opportunityController.updateOpportunity);
  router.delete("/:id", opportunityController.deleteOpportunity);

  return router;
};