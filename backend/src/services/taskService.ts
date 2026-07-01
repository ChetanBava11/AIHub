import type { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors";
import { logAudit } from "../lib/auditLogger";
import { scopedPrisma } from "../lib/scopedPrisma";

export type CreateTaskInput = {
  description: string;
  dueDate: Date;
  contactId?: string;
};

export type UpdateTaskInput = Partial<CreateTaskInput> & {
  completed?: boolean;
};

type TaskRecord = {
  id: string;
  tenantId: string;
  contactId: string | null;
  description: string;
  dueDate: Date;
  completed: boolean;
  createdAt: Date;
};

const toAuditContact = (contact: {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  status: string;
  lastContactedAt: Date | null;
  createdAt: Date;
}) => ({
  id: contact.id,
  tenantId: contact.tenantId,
  name: contact.name,
  phone: contact.phone,
  email: contact.email,
  company: contact.company,
  status: contact.status,
  lastContactedAt: contact.lastContactedAt ? contact.lastContactedAt.toISOString() : null,
  createdAt: contact.createdAt.toISOString()
});

const toAuditTask = (task: TaskRecord) => ({
  id: task.id,
  tenantId: task.tenantId,
  contactId: task.contactId,
  description: task.description,
  dueDate: task.dueDate.toISOString(),
  completed: task.completed,
  createdAt: task.createdAt.toISOString()
});

const getTenantContact = async (tenantId: string, contactId: string) => {
  return scopedPrisma(tenantId).contact.findFirst({
    where: {
      id: contactId
    }
  });
};

export class TaskService {
  async listTasks(tenantId: string, completed?: boolean) {
    const where = completed === undefined ? undefined : { completed };

    const [data, count] = await Promise.all([
      scopedPrisma(tenantId).task.findMany({
        where,
        orderBy: [{ completed: "asc" }, { dueDate: "asc" }]
      }),
      scopedPrisma(tenantId).task.count({ where })
    ]);

    return { data, count };
  }

  async createTask(tenantId: string, userId: string, input: CreateTaskInput) {
    let contact = null;

    if (input.contactId) {
      contact = await getTenantContact(tenantId, input.contactId);

      if (!contact) {
        throw new AppError("Contact not found or not accessible.", 403);
      }
    }

    try {
      const task = await scopedPrisma(tenantId).task.create({
        data: {
          description: input.description,
          dueDate: input.dueDate,
          contactId: input.contactId
        }
      });

      await logAudit({
        tenantId,
        userId,
        action: "TASK_CREATED",
        details: {
          task: toAuditTask(task),
          contact: contact ? toAuditContact(contact) : null
        }
      });

      return task;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Unable to create task.", 500);
    }
  }

  async getTaskById(tenantId: string, id: string) {
    const task = await scopedPrisma(tenantId).task.findFirst({
      where: {
        id
      }
    });

    if (!task) {
      throw new AppError("Task not found.", 404);
    }

    return task;
  }

  async updateTask(tenantId: string, userId: string, id: string, input: UpdateTaskInput) {
    const existingTask = await scopedPrisma(tenantId).task.findFirst({
      where: {
        id
      }
    });

    if (!existingTask) {
      throw new AppError("Task not found.", 404);
    }

    let contact = null;

    if (input.contactId !== undefined) {
      if (input.contactId === null) {
        throw new AppError("Contact not found or not accessible.", 403);
      }

      if (input.contactId !== existingTask.contactId) {
        contact = await getTenantContact(tenantId, input.contactId);

        if (!contact) {
          throw new AppError("Contact not found or not accessible.", 403);
        }
      }
    }

    try {
      await scopedPrisma(tenantId).task.updateMany({
        where: {
          id
        },
        data: {
          ...input
        }
      });

      const updatedTask = await scopedPrisma(tenantId).task.findFirst({
        where: {
          id
        }
      });

      if (!updatedTask) {
        throw new AppError("Task not found.", 404);
      }

      const resolvedContact =
        input.contactId === undefined
          ? existingTask.contactId
            ? await getTenantContact(tenantId, existingTask.contactId)
            : null
          : contact ?? (input.contactId ? await getTenantContact(tenantId, input.contactId) : null);

      await logAudit({
        tenantId,
        userId,
        action: "TASK_UPDATED",
        details: {
          before: toAuditTask(existingTask),
          after: toAuditTask(updatedTask),
          contact: resolvedContact ? toAuditContact(resolvedContact) : null
        }
      });

      return updatedTask;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Unable to update task.", 500);
    }
  }

  async deleteTask(tenantId: string, userId: string, id: string) {
    const existingTask = await scopedPrisma(tenantId).task.findFirst({
      where: {
        id
      }
    });

    if (!existingTask) {
      throw new AppError("Task not found.", 404);
    }

    try {
      await scopedPrisma(tenantId).task.deleteMany({
        where: {
          id
        }
      });

      await logAudit({
        tenantId,
        userId,
        action: "TASK_DELETED",
        details: {
          task: toAuditTask(existingTask)
        }
      });

      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Unable to delete task.", 500);
    }
  }
}