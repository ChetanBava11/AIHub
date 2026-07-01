import { z } from "zod";

export const createTaskSchema = z.object({
  contactId: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).max(1000),
  dueDate: z.coerce.date(),
  completed: z.boolean().default(false)
});

export const updateTaskSchema = createTaskSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one task field must be provided."
});

export const queryTaskSchema = z.object({
  id: z.string().trim().min(1).optional(),
  contactId: z.string().trim().min(1).optional(),
  completed: z.coerce.boolean().optional(),
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25)
});