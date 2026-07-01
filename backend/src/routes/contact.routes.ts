import { Router } from "express";
import type { createContactController } from "../controllers/contactController";
import { requireAuth } from "../middleware/requireAuth";

export const buildContactRouter = (
  contactController: ReturnType<typeof createContactController>
) => {
  const router = Router();

  router.use(requireAuth);
  router.get("/", contactController.listContacts);
  router.post("/", contactController.createContact);
  router.get("/:id", contactController.getContact);
  router.put("/:id", contactController.updateContact);
  router.delete("/:id", contactController.deleteContact);

  return router;
};