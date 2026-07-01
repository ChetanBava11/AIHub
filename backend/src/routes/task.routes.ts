import { Router } from "express";
import type { createTaskController } from "../controllers/taskController";
import { requireAuth } from "../middleware/requireAuth";

export const buildTaskRouter = (taskController: ReturnType<typeof createTaskController>) => {
  const router = Router();

  router.use(requireAuth);
  router.get("/", taskController.listTasks);
  router.post("/", taskController.createTask);
  router.get("/:id", taskController.getTask);
  router.put("/:id", taskController.updateTask);
  router.delete("/:id", taskController.deleteTask);

  return router;
};