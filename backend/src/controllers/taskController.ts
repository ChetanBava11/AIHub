import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import {
  createTaskSchema,
  queryTaskSchema,
  updateTaskSchema
} from "../validators/task.validator";
import type { TaskService } from "../services/taskService";

const idParamSchema = z.object({
  id: z.string().trim().min(1)
});

export const createTaskController = (taskService: TaskService) => ({
  listTasks: asyncHandler(async (req: Request, res: Response) => {
    const query = queryTaskSchema.parse(req.query);
    const result = await taskService.listTasks(req.auth!.tenantId, query.completed);

    res.json(result);
  }),

  createTask: asyncHandler(async (req: Request, res: Response) => {
    const payload = createTaskSchema.parse(req.body);
    const task = await taskService.createTask(req.auth!.tenantId, req.auth!.userId, payload);

    res.status(201).json({ task });
  }),

  getTask: asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const task = await taskService.getTaskById(req.auth!.tenantId, id);

    res.json({ task });
  }),

  updateTask: asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const payload = updateTaskSchema.parse(req.body);
    const task = await taskService.updateTask(req.auth!.tenantId, req.auth!.userId, id, payload);

    res.json({ task });
  }),

  deleteTask: asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    await taskService.deleteTask(req.auth!.tenantId, req.auth!.userId, id);

    res.status(204).send();
  })
});