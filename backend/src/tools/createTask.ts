import { z } from "zod";
import type { Task } from "@prisma/client";
import type { CreateTaskInput } from "./types";
import { AppError } from "../lib/errors";
import { logAudit } from "../lib/auditLogger";
import { scopedPrisma } from "../lib/scopedPrisma";

const createTaskSchema = z.object({
  tenantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  contactId: z.string().trim().min(1),
  description: z.string().trim().min(1),
  dueDate: z.string().refine(
    (value) => !Number.isNaN(Date.parse(value)),
    {
      message: "dueDate must be a valid ISO date string."
    }
  )
});

export async function createTask(input: CreateTaskInput): Promise<Task>;
export async function createTask(
  tenantId: string,
  userId: string,
  contactId: string,
  description: string,
  dueDate: string
): Promise<Task>;
export async function createTask(
  arg1: string | CreateTaskInput,
  userId?: string,
  contactId?: string,
  description?: string,
  dueDate?: string
): Promise<Task> {
  const payload =
    typeof arg1 === "string"
      ? {
          tenantId: arg1,
          userId: userId ?? "",
          contactId: contactId ?? "",
          description: description ?? "",
          dueDate: dueDate ?? ""
        }
      : arg1;

  const validated = createTaskSchema.parse(payload);

  const contact = await scopedPrisma(validated.tenantId).contact.findFirst({
    where: {
      id: validated.contactId
    }
  });

  if (!contact) {
    throw new AppError("Contact not found or not accessible.", 403);
  }

  const task = await scopedPrisma(validated.tenantId).task.create({
    data: {
      contactId: validated.contactId,
      description: validated.description,
      dueDate: new Date(validated.dueDate)
    }
  });

  await logAudit({
    tenantId: validated.tenantId,
    userId: validated.userId,
    action: "AI_TOOL_CREATE_TASK",
    details: {
      contactId: validated.contactId,
      taskId: task.id,
      dueDate: validated.dueDate
    }
  });

  return task;
}
