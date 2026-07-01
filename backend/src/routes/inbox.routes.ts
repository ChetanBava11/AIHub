import { Router } from "express";
import type { createInboxController } from "../controllers/inboxController";
import { requireAuth } from "../middleware/requireAuth";

export const buildInboxRouter = (inboxController: ReturnType<typeof createInboxController>) => {
  const router = Router();

  router.use(requireAuth);
  router.get("/", inboxController.listInbox);
  router.post("/seed-demo-data", inboxController.seedDemoData);
  router.get("/:contactId", inboxController.getInboxThread);

  return router;
};