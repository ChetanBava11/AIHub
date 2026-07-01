import request from "supertest";
import { signAccessToken } from "../src/lib/jwt";

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

  const contactStore = new Map<string, ContactRecord>();

  const mockContactDelegate = {
    findMany: jest.fn(async (args?: { where?: { tenantId?: string; OR?: Array<Record<string, unknown>> } }) => {
      const tenantId = args?.where?.tenantId;
      const searchClauses = args?.where?.OR ?? [];

      return Array.from(contactStore.values())
        .filter((contact) => contact.tenantId === tenantId)
        .filter((contact) => {
          if (searchClauses.length === 0) {
            return true;
          }

          return searchClauses.some((clause) => {
            const [[field, condition]] = Object.entries(clause);

            if (!condition || typeof condition !== "object") {
              return false;
            }

            const contains = String((condition as { contains?: string }).contains ?? "").toLowerCase();
            const value = String((contact as Record<string, unknown>)[field] ?? "").toLowerCase();

            return value.includes(contains);
          });
        })
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    }),
    findFirst: jest.fn(async (args?: { where?: { tenantId?: string; id?: string } }) => {
      const tenantId = args?.where?.tenantId;
      const id = args?.where?.id;
      const contact = id ? contactStore.get(id) : undefined;

      if (!contact || contact.tenantId !== tenantId) {
        return null;
      }

      return contact;
    }),
    count: jest.fn(async () => 0),
    create: jest.fn(async (args?: { data?: Partial<ContactRecord> & { tenantId?: string } }) => {
      const createdAt = new Date();
      const id = `contact-${contactStore.size + 1}`;
      const record: ContactRecord = {
        id,
        tenantId: args?.data?.tenantId ?? "",
        name: String(args?.data?.name ?? ""),
        phone: String(args?.data?.phone ?? ""),
        email: (args?.data?.email as string | undefined) ?? null,
        company: (args?.data?.company as string | undefined) ?? null,
        status: String(args?.data?.status ?? ""),
        lastContactedAt: (args?.data?.lastContactedAt as Date | undefined) ?? null,
        createdAt
      };

      contactStore.set(id, record);
      return record;
    }),
    updateMany: jest.fn(async (args?: { where?: { tenantId?: string; id?: string }; data?: Partial<ContactRecord> }) => {
      const tenantId = args?.where?.tenantId;
      const id = args?.where?.id;
      const contact = id ? contactStore.get(id) : undefined;

      if (!contact || contact.tenantId !== tenantId) {
        return { count: 0 };
      }

      const updated = {
        ...contact,
        ...args?.data,
        tenantId: contact.tenantId,
        createdAt: contact.createdAt
      };

      contactStore.set(id!, updated);
      return { count: 1 };
    }),
    deleteMany: jest.fn(async (args?: { where?: { tenantId?: string; id?: string } }) => {
      const tenantId = args?.where?.tenantId;
      const id = args?.where?.id;
      const contact = id ? contactStore.get(id) : undefined;

      if (!contact || contact.tenantId !== tenantId) {
        return { count: 0 };
      }

      contactStore.delete(id!);
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
      task: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn()
      },
      auditLog: mockAuditLogDelegate
    },
    mockContactDelegate,
    mockAuditLogDelegate,
    resetContactStore: () => {
      contactStore.clear();
    },
    seedContactStore: (contacts: ContactRecord[]) => {
      contactStore.clear();
      contacts.forEach((contact) => contactStore.set(contact.id, contact));
    }
  };
});

import { createTestHarness } from "./support/testApp";

const prismaMocks = require("../src/prisma/client") as {
  mockAuditLogDelegate: {
    create: jest.Mock;
  };
  mockContactDelegate: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  resetContactStore: () => void;
  seedContactStore: (contacts: Array<Record<string, unknown>>) => void;
};

const { mockAuditLogDelegate, mockContactDelegate, resetContactStore, seedContactStore } = prismaMocks;

describe("contacts routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetContactStore();
  });

  it("returns tenant-scoped contacts and supports search", async () => {
    const { app, authRepository } = createTestHarness();
    const { user: userA } = await authRepository.upsertGoogleUser({
      googleId: "google-a",
      email: "a@example.com",
      name: "Tenant A"
    });
    const { user: userB } = await authRepository.upsertGoogleUser({
      googleId: "google-b",
      email: "b@example.com",
      name: "Tenant B"
    });

    seedContactStore([
      {
        id: "contact-a",
        tenantId: userA.tenantId,
        name: "Rahul Mehta",
        phone: "555-0101",
        email: "rahul@example.com",
        company: "Alpha Co",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      },
      {
        id: "contact-b",
        tenantId: userB.tenantId,
        name: "Rahuul Singh",
        phone: "555-0202",
        email: "b@example.com",
        company: "Beta Co",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-02T00:00:00.000Z")
      }
    ]);

    const responseA = await request(app)
      .get("/contacts?search=rahul")
      .set("Cookie", [`access_token=${signAccessToken({ userId: userA.id, tenantId: userA.tenantId })}`]);

    const responseB = await request(app)
      .get("/contacts?search=rahul")
      .set("Cookie", [`access_token=${signAccessToken({ userId: userB.id, tenantId: userB.tenantId })}`]);

    expect(responseA.status).toBe(200);
    expect(responseA.body.contacts).toHaveLength(1);
    expect(responseA.body.contacts[0].tenantId).toBe(userA.tenantId);
    expect(responseB.status).toBe(200);
    expect(responseB.body.contacts).toHaveLength(0);

    expect(mockContactDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: userA.tenantId,
          OR: expect.any(Array)
        })
      })
    );
  });

  it("creates a contact and writes an audit log", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-create",
      email: "creator@example.com",
      name: "Creator"
    });

    const response = await request(app)
      .post("/contacts")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`])
      .send({
        name: "New Contact",
        phone: "555-0303",
        email: "new@example.com",
        company: "Gamma Co",
        status: "ACTIVE"
      });

    expect(response.status).toBe(201);
    expect(response.body.contact.name).toBe("New Contact");
    expect(mockContactDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: user.tenantId,
          name: "New Contact"
        })
      })
    );
    expect(mockAuditLogDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: user.tenantId,
          userId: user.id,
          action: "contacts.create"
        })
      })
    );
  });

  it("rejects invalid contact payloads with 400", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-invalid",
      email: "invalid@example.com",
      name: "Invalid"
    });

    const response = await request(app)
      .post("/contacts")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`])
      .send({
        name: ""
      });

    expect(response.status).toBe(400);
    expect(mockContactDelegate.create).not.toHaveBeenCalled();
  });

  it("updates only the authenticated tenant's contact and logs the change", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-update",
      email: "updater@example.com",
      name: "Updater"
    });

    seedContactStore([
      {
        id: "contact-a",
        tenantId: user.tenantId,
        name: "Rahul Mehta",
        phone: "555-0101",
        email: "rahul@example.com",
        company: "Alpha Co",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ]);

    const response = await request(app)
      .put("/contacts/contact-a")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`])
      .send({
        status: "INACTIVE"
      });

    expect(response.status).toBe(200);
    expect(response.body.contact.status).toBe("INACTIVE");
    expect(mockContactDelegate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: user.tenantId,
          id: "contact-a"
        })
      })
    );
    expect(mockAuditLogDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: user.tenantId,
          userId: user.id,
          action: "contacts.update"
        })
      })
    );
  });

  it("deletes only the authenticated tenant's contact and logs the deletion", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-delete",
      email: "deleter@example.com",
      name: "Deleter"
    });

    seedContactStore([
      {
        id: "contact-a",
        tenantId: user.tenantId,
        name: "Rahul Mehta",
        phone: "555-0101",
        email: "rahul@example.com",
        company: "Alpha Co",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ]);

    const response = await request(app)
      .delete("/contacts/contact-a")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`]);

    expect(response.status).toBe(204);
    expect(mockContactDelegate.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: user.tenantId,
          id: "contact-a"
        })
      })
    );
    expect(mockAuditLogDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: user.tenantId,
          userId: user.id,
          action: "contacts.delete"
        })
      })
    );
  });
});