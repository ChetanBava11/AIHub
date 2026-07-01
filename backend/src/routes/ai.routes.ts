import { Router } from "express";
import type { createAIController } from "../controllers/aiController";
import { requireAuth } from "../middleware/requireAuth";

export const buildAIRouter = (
  aiController: ReturnType<typeof createAIController>
) => {
  const router = Router();

  router.use(requireAuth);
  router.post("/chat", aiController.chat);
  router.get("/conversations", aiController.listConversations);
  router.get("/conversations/:id", aiController.getConversation);

  return router;
};
