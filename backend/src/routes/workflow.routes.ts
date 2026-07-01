import { Router } from "express";
import type { createWorkflowController } from "../controllers/workflowController";
import { requireAuth } from "../middleware/requireAuth";

export const buildWorkflowRouter = (
  workflowController: ReturnType<typeof createWorkflowController>
) => {
  const router = Router();

  router.use(requireAuth);
  router.post("/lead-qualification", workflowController.qualifyLead);

  return router;
};
