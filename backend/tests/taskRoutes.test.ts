import request from "supertest";
import { signAccessToken } from "../src/lib/jwt";
import { createTestHarness } from "./support/testApp";

jest.mock("../src/prisma/client", () => {
  type ContactRecord = {
    id: string;
    tenantId: string;
    name: string;
    phone: string;
    email: string | null;
    company: string | null;
    status: string;
    lastContactedAt: Date | null;
    createdAt: Date;
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

  const contactStore = new Map<string, ContactRecord>();
  const taskStore = new Map<string, TaskRecord>();

  const mockContactDelegate = {
    findMany: jest.fn(),
    findFirst: jest.fn(async (args?: { where?: { tenantId?: string; id?: string } }) => {
      const tenantId = args?.where?.tenantId;
      const id = args?.where?.id;
      const contact = id ? contactStore.get(id) : undefined;

      if (!contact || contact.tenantId !== tenantId) {
        return null;
      }

      return contact;
    }),
    count: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  };

  const mockTaskDelegate = {
    findMany: jest.fn(async (args?: { where?: { tenantId?: string; completed?: boolean } }) => {
      const tenantId = args?.where?.tenantId;
      const completed = args?.where?.completed;

      return Array.from(taskStore.values())
        .filter((task) => task.tenantId === tenantId)
        .filter((task) => (completed === undefined ? true : task.completed === completed))
        .sort((left, right) => {
          if (left.completed !== right.completed) {
            return Number(left.completed) - Number(right.completed);
          }

          return left.dueDate.getTime() - right.dueDate.getTime();
        });
    }),
    findFirst: jest.fn(async (args?: { where?: { tenantId?: string; id?: string } }) => {
      const tenantId = args?.where?.tenantId;
      const id = args?.where?.id;
      const task = id ? taskStore.get(id) : undefined;

      if (!task || task.tenantId !== tenantId) {
        return null;
      }

      return task;
    }),
    count: jest.fn(async (args?: { where?: { tenantId?: string; completed?: boolean } }) => {
      const tenantId = args?.where?.tenantId;
      const completed = args?.where?.completed;

      return Array.from(taskStore.values()).filter(
        (task) => task.tenantId === tenantId && (completed === undefined ? true : task.completed === completed)
      ).length;
    }),
    create: jest.fn(async (args?: { data?: Partial<TaskRecord> & { tenantId?: string } }) => {
      const record: TaskRecord = {
        id: `task-${taskStore.size + 1}`,
        tenantId: args?.data?.tenantId ?? "",
        contactId: (args?.data?.contactId as string | null | undefined) ?? null,
        description: String(args?.data?.description ?? ""),
        dueDate: new Date(String(args?.data?.dueDate ?? new Date().toISOString())),
        completed: Boolean(args?.data?.completed ?? false),
        createdAt: new Date()
      };

      taskStore.set(record.id, record);
      return record;
    }),
    updateMany: jest.fn(async (args?: { where?: { tenantId?: string; id?: string }; data?: Partial<TaskRecord> }) => {
      const tenantId = args?.where?.tenantId;
      const id = args?.where?.id;
      const task = id ? taskStore.get(id) : undefined;

      if (!task || task.tenantId !== tenantId) {
        return { count: 0 };
      }

      const updated: TaskRecord = {
        ...task,
        ...args?.data,
        tenantId: task.tenantId,
        contactId:
          args?.data?.contactId === undefined ? task.contactId : ((args.data.contactId as string | null) ?? null),
        description: String(args?.data?.description ?? task.description),
        dueDate: args?.data?.dueDate ? new Date(String(args.data.dueDate)) : task.dueDate,
        completed: args?.data?.completed === undefined ? task.completed : Boolean(args.data.completed),
        createdAt: task.createdAt
      };

      taskStore.set(id!, updated);
      return { count: 1 };
    }),
    deleteMany: jest.fn(async (args?: { where?: { tenantId?: string; id?: string } }) => {
      const tenantId = args?.where?.tenantId;
      const id = args?.where?.id;
      const task = id ? taskStore.get(id) : undefined;

      if (!task || task.tenantId !== tenantId) {
        return { count: 0 };
      }

      taskStore.delete(id!);
      return { count: 1 };
    })
  };

  const mockAuditLogDelegate = {
    create: jest.fn(async (args?: unknown) => args),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  };

  return {
    prisma: {
      contact: mockContactDelegate,
      opportunity: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn()
      },
      task: mockTaskDelegate,
      auditLog: mockAuditLogDelegate
    },
    mockTaskDelegate,
    mockAuditLogDelegate,
    seedContacts: (contacts: ContactRecord[]) => {
      contactStore.clear();
      contacts.forEach((contact) => contactStore.set(contact.id, contact));
    },
    seedTasks: (tasks: TaskRecord[]) => {
      taskStore.clear();
      tasks.forEach((task) => taskStore.set(task.id, task));
    },
    resetStores: () => {
      contactStore.clear();
      taskStore.clear();
    }
  };
});

const prismaMocks = require("../src/prisma/client") as {
  mockTaskDelegate: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  mockAuditLogDelegate: { create: jest.Mock };
  seedContacts: (contacts: Array<Record<string, unknown>>) => void;
  seedTasks: (tasks: Array<Record<string, unknown>>) => void;
  resetStores: () => void;
};

const { mockTaskDelegate, mockAuditLogDelegate, seedContacts, seedTasks, resetStores } = prismaMocks;

describe("task routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
  });

  const seedTenantContact = (tenantId: string) => {
    seedContacts([
      {
        id: "contact-task-a",
        tenantId,
        name: "Task Contact",
        phone: "555-5001",
        email: "task@example.com",
        company: "Acme",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ]);
  };

  it("creates a task and writes an audit log", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-task-create",
      email: "task-create@example.com",
      name: "Task Creator"
    });

    seedTenantContact(user.tenantId);

    const response = await request(app)
      .post("/tasks")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`])
      .send({
        description: "Follow up call",
        dueDate: "2026-07-10T10:00:00.000Z",
        contactId: "contact-task-a"
      });

    expect(response.status).toBe(201);
    expect(response.body.task.description).toBe("Follow up call");
    expect(mockTaskDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: user.tenantId,
          contactId: "contact-task-a"
        })
      })
    );
    expect(mockAuditLogDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: user.tenantId,
          userId: user.id,
          action: "TASK_CREATED"
        })
      })
    );
  });

  it("returns tenant tasks and supports completed filtering", async () => {
    const { app, authRepository } = createTestHarness();
    const { user: userA } = await authRepository.upsertGoogleUser({
      googleId: "google-task-a",
      email: "a@example.com",
      name: "Tenant A"
    });
    const { user: userB } = await authRepository.upsertGoogleUser({
      googleId: "google-task-b",
      email: "b@example.com",
      name: "Tenant B"
    });

    seedContacts([
      { id: "contact-a", tenantId: userA.tenantId, name: "A", phone: "1", email: null, company: null, status: "ACTIVE", lastContactedAt: null, createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { id: "contact-b", tenantId: userB.tenantId, name: "B", phone: "2", email: null, company: null, status: "ACTIVE", lastContactedAt: null, createdAt: new Date("2026-01-01T00:00:00.000Z") }
    ]);

    seedTasks([
      { id: "task-1", tenantId: userA.tenantId, contactId: "contact-a", description: "Complete later", dueDate: new Date("2026-02-02T00:00:00.000Z"), completed: false, createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { id: "task-2", tenantId: userA.tenantId, contactId: "contact-a", description: "Complete sooner", dueDate: new Date("2026-02-01T00:00:00.000Z"), completed: false, createdAt: new Date("2026-01-02T00:00:00.000Z") },
      { id: "task-3", tenantId: userA.tenantId, contactId: "contact-a", description: "Completed task", dueDate: new Date("2026-01-01T00:00:00.000Z"), completed: true, createdAt: new Date("2026-01-03T00:00:00.000Z") },
      { id: "task-4", tenantId: userB.tenantId, contactId: "contact-b", description: "Other tenant", dueDate: new Date("2026-01-01T00:00:00.000Z"), completed: false, createdAt: new Date("2026-01-04T00:00:00.000Z") }
    ]);

    const response = await request(app)
      .get("/tasks?completed=false")
      .set("Cookie", [`access_token=${signAccessToken({ userId: userA.id, tenantId: userA.tenantId })}`]);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.data.map((task: { id: string }) => task.id)).toEqual(["task-2", "task-1"]);
  });

  it("updates a task and marks it completed", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-task-update",
      email: "task-update@example.com",
      name: "Task Updater"
    });

    seedTenantContact(user.tenantId);
    seedTasks([
      {
        id: "task-update",
        tenantId: user.tenantId,
        contactId: "contact-task-a",
        description: "Needs work",
        dueDate: new Date("2026-07-10T10:00:00.000Z"),
        completed: false,
        createdAt: new Date("2026-07-01T00:00:00.000Z")
      }
    ]);

    const response = await request(app)
      .put("/tasks/task-update")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`])
      .send({
        description: "Updated work",
        completed: true,
        contactId: "contact-task-a"
      });

    expect(response.status).toBe(200);
    expect(response.body.task.completed).toBe(true);
    expect(response.body.task.description).toBe("Updated work");
    expect(mockAuditLogDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: user.tenantId,
          userId: user.id,
          action: "TASK_UPDATED"
        })
      })
    );
  });

  it("rejects invalid and cross-tenant contacts", async () => {
    const { app, authRepository } = createTestHarness();
    const { user: userA } = await authRepository.upsertGoogleUser({
      googleId: "google-task-cross-a",
      email: "a@example.com",
      name: "Tenant A"
    });
    const { user: userB } = await authRepository.upsertGoogleUser({
      googleId: "google-task-cross-b",
      email: "b@example.com",
      name: "Tenant B"
    });

    seedContacts([
      { id: "contact-a", tenantId: userA.tenantId, name: "Tenant A Contact", phone: "555-7001", email: "a@example.com", company: "Acme", status: "ACTIVE", lastContactedAt: null, createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { id: "contact-b", tenantId: userB.tenantId, name: "Tenant B Contact", phone: "555-7002", email: "b@example.com", company: "Beta", status: "ACTIVE", lastContactedAt: null, createdAt: new Date("2026-01-01T00:00:00.000Z") }
    ]);

    const crossTenantResponse = await request(app)
      .post("/tasks")
      .set("Cookie", [`access_token=${signAccessToken({ userId: userA.id, tenantId: userA.tenantId })}`])
      .send({
        description: "Cross tenant",
        dueDate: "2026-07-10T10:00:00.000Z",
        contactId: "contact-b"
      });

    expect(crossTenantResponse.status).toBe(403);

    const invalidResponse = await request(app)
      .post("/tasks")
      .set("Cookie", [`access_token=${signAccessToken({ userId: userA.id, tenantId: userA.tenantId })}`])
      .send({
        description: "Missing due date"
      });

    expect(invalidResponse.status).toBe(400);
  });

  it("deletes a task and logs the deletion", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-task-delete",
      email: "task-delete@example.com",
      name: "Task Deleter"
    });

    seedTenantContact(user.tenantId);
    seedTasks([
      {
        id: "task-delete",
        tenantId: user.tenantId,
        contactId: "contact-task-a",
        description: "Delete me",
        dueDate: new Date("2026-07-10T10:00:00.000Z"),
        completed: false,
        createdAt: new Date("2026-07-01T00:00:00.000Z")
      }
    ]);

    const response = await request(app)
      .delete("/tasks/task-delete")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`]);

    expect(response.status).toBe(204);
    expect(mockAuditLogDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: user.tenantId,
          userId: user.id,
          action: "TASK_DELETED"
        })
      })
    );
  });
});