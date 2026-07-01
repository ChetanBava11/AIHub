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

  const contactStore = new Map<string, ContactRecord>();

  const mockContactDelegate = {
    findMany: jest.fn(async (args?: { where?: { tenantId?: string; id?: { in?: string[] }; email?: { in?: string[] } } }) => {
      const tenantId = args?.where?.tenantId;
      const ids = args?.where?.id?.in;
      const emails = args?.where?.email?.in;

      return Array.from(contactStore.values())
        .filter((contact) => contact.tenantId === tenantId)
        .filter((contact) => (ids ? ids.includes(contact.id) : true))
        .filter((contact) => (emails ? (contact.email ? emails.includes(contact.email) : false) : true));
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
    count: jest.fn(async () => Array.from(contactStore.values()).length),
    create: jest.fn(async (args?: { data?: Partial<ContactRecord> & { tenantId?: string } }) => {
      const record: ContactRecord = {
        id: `contact-${contactStore.size + 1}`,
        tenantId: args?.data?.tenantId ?? "",
        name: String(args?.data?.name ?? ""),
        phone: String(args?.data?.phone ?? ""),
        email: (args?.data?.email as string | undefined) ?? null,
        company: (args?.data?.company as string | undefined) ?? null,
        status: String(args?.data?.status ?? ""),
        lastContactedAt: (args?.data?.lastContactedAt as Date | null | undefined) ?? null,
        createdAt: new Date()
      };

      contactStore.set(record.id, record);
      return record;
    }),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  };

  const mockOpportunityDelegate = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  };

  const mockTaskDelegate = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  };

  const mockAuditLogDelegate = {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  };

  return {
    prisma: {
      contact: mockContactDelegate,
      opportunity: mockOpportunityDelegate,
      task: mockTaskDelegate,
      auditLog: mockAuditLogDelegate
    },
    mockContactDelegate,
    resetContacts: () => {
      contactStore.clear();
    },
    seedContacts: (contacts: ContactRecord[]) => {
      contactStore.clear();
      contacts.forEach((contact) => contactStore.set(contact.id, contact));
    }
  };
});

jest.mock("../src/models/InboxMessage", () => {
  type InboxMessageRecord = {
    tenantId: string;
    contactId: string;
    channel: "whatsapp" | "email" | "call";
    direction: "in" | "out";
    content: string;
    sentiment?: string | null;
    intent?: string | null;
    summary?: string | null;
    createdAt: Date;
  };

  const messageStore = new Map<string, InboxMessageRecord>();

  const queryMessages = (filter: { tenantId?: string; contactId?: string }) =>
    Array.from(messageStore.values())
      .filter((message) => message.tenantId === filter.tenantId)
      .filter((message) => (filter.contactId ? message.contactId === filter.contactId : true));

  return {
    InboxMessage: {
      find: jest.fn((filter: { tenantId?: string; contactId?: string }) => ({
        sort: (sortSpec: { createdAt: 1 | -1 }) => ({
          exec: async () =>
            queryMessages(filter).sort((left, right) =>
              sortSpec.createdAt === 1
                ? left.createdAt.getTime() - right.createdAt.getTime()
                : right.createdAt.getTime() - left.createdAt.getTime()
            )
        })
      })),
      create: jest.fn(async (data: InboxMessageRecord) => {
        const key = `${data.tenantId}:${data.contactId}:${data.createdAt.toISOString()}:${data.content}`;
        messageStore.set(key, data);
        return data;
      })
    },
    seedMessages: (messages: InboxMessageRecord[]) => {
      messageStore.clear();
      messages.forEach((message) => {
        const key = `${message.tenantId}:${message.contactId}:${message.createdAt.toISOString()}:${message.content}`;
        messageStore.set(key, message);
      });
    },
    resetMessages: () => {
      messageStore.clear();
    }
  };
});

const prismaMocks = require("../src/prisma/client") as {
  mockContactDelegate: { findMany: jest.Mock };
  seedContacts: (contacts: Array<Record<string, unknown>>) => void;
  resetContacts: () => void;
};

const inboxMocks = require("../src/models/InboxMessage") as {
  seedMessages: (messages: Array<Record<string, unknown>>) => void;
  resetMessages: () => void;
};

const { mockContactDelegate, seedContacts, resetContacts } = prismaMocks;
const { seedMessages, resetMessages } = inboxMocks;

describe("inbox routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetContacts();
    resetMessages();
  });

  const seedTenantContacts = (tenantId: string) => {
    seedContacts([
      {
        id: "contact-a",
        tenantId,
        name: "Rahul Mehta",
        phone: "555-1001",
        email: "rahul@example.com",
        company: "Alpha",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      },
      {
        id: "contact-b",
        tenantId,
        name: "Priya Singh",
        phone: "555-1002",
        email: "priya@example.com",
        company: "Beta",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-02T00:00:00.000Z")
      }
    ]);
  };

  it("returns one conversation per contact sorted by latest message", async () => {
    const { app, authRepository } = createTestHarness();
    const { user: userA } = await authRepository.upsertGoogleUser({
      googleId: "google-inbox-a",
      email: "a@example.com",
      name: "Tenant A"
    });
    const { user: userB } = await authRepository.upsertGoogleUser({
      googleId: "google-inbox-b",
      email: "b@example.com",
      name: "Tenant B"
    });

    seedContacts([
      { id: "contact-a", tenantId: userA.tenantId, name: "A", phone: "1", email: null, company: null, status: "ACTIVE", lastContactedAt: null, createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { id: "contact-b", tenantId: userA.tenantId, name: "B", phone: "2", email: null, company: null, status: "ACTIVE", lastContactedAt: null, createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { id: "contact-other", tenantId: userB.tenantId, name: "Other", phone: "3", email: null, company: null, status: "ACTIVE", lastContactedAt: null, createdAt: new Date("2026-01-01T00:00:00.000Z") }
    ]);

    seedMessages([
      {
        tenantId: userA.tenantId,
        contactId: "contact-a",
        channel: "email",
        direction: "in",
        content: "Old A",
        createdAt: new Date("2026-06-29T10:00:00.000Z")
      },
      {
        tenantId: userA.tenantId,
        contactId: "contact-a",
        channel: "whatsapp",
        direction: "out",
        content: "New A",
        createdAt: new Date("2026-06-30T10:00:00.000Z")
      },
      {
        tenantId: userA.tenantId,
        contactId: "contact-b",
        channel: "call",
        direction: "in",
        content: "Only B",
        createdAt: new Date("2026-06-30T12:00:00.000Z")
      },
      {
        tenantId: userB.tenantId,
        contactId: "contact-other",
        channel: "email",
        direction: "in",
        content: "Should not show",
        createdAt: new Date("2026-06-30T13:00:00.000Z")
      }
    ]);

    const response = await request(app)
      .get("/inbox")
      .set("Cookie", [`access_token=${signAccessToken({ userId: userA.id, tenantId: userA.tenantId })}`]);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].contact.id).toBe("contact-b");
    expect(response.body[0].lastMessage.content).toBe("Only B");
    expect(response.body[1].contact.id).toBe("contact-a");
    expect(response.body[1].lastMessage.content).toBe("New A");
    expect(mockContactDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: userA.tenantId,
          id: expect.objectContaining({ in: expect.arrayContaining(["contact-a", "contact-b"]) })
        })
      })
    );
  });

  it("returns the full inbox timeline for a contact", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-inbox-thread",
      email: "thread@example.com",
      name: "Thread User"
    });

    seedTenantContacts(user.tenantId);
    seedMessages([
      {
        tenantId: user.tenantId,
        contactId: "contact-a",
        channel: "email",
        direction: "in",
        content: "First",
        createdAt: new Date("2026-06-28T10:00:00.000Z")
      },
      {
        tenantId: user.tenantId,
        contactId: "contact-a",
        channel: "whatsapp",
        direction: "out",
        content: "Second",
        createdAt: new Date("2026-06-29T10:00:00.000Z")
      },
      {
        tenantId: user.tenantId,
        contactId: "contact-a",
        channel: "call",
        direction: "in",
        content: "Third",
        createdAt: new Date("2026-06-30T10:00:00.000Z")
      }
    ]);

    const response = await request(app)
      .get("/inbox/contact-a")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`]);

    expect(response.status).toBe(200);
    expect(response.body.contact.id).toBe("contact-a");
    expect(response.body.messages.map((message: { content: string }) => message.content)).toEqual([
      "First",
      "Second",
      "Third"
    ]);
  });

  it("seeds demo data in development and blocks production", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-inbox-demo",
      email: "demo@example.com",
      name: "Demo User"
    });

    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const seedResponse = await request(app)
      .post("/inbox/seed-demo-data")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`]);

    expect(seedResponse.status).toBe(201);

    const inboxResponse = await request(app)
      .get("/inbox")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`]);

    expect(inboxResponse.status).toBe(200);
    expect(inboxResponse.body).toHaveLength(3);

    process.env.NODE_ENV = "production";

    const blockedResponse = await request(app)
      .post("/inbox/seed-demo-data")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`]);

    expect(blockedResponse.status).toBe(403);

    process.env.NODE_ENV = previousEnv;
  });

  it("rejects cross-tenant inbox access and keeps the tenant boundary intact", async () => {
    const { app, authRepository } = createTestHarness();
    const { user: userA } = await authRepository.upsertGoogleUser({
      googleId: "google-inbox-tenant-a",
      email: "a@example.com",
      name: "Tenant A"
    });
    const { user: userB } = await authRepository.upsertGoogleUser({
      googleId: "google-inbox-tenant-b",
      email: "b@example.com",
      name: "Tenant B"
    });

    seedContacts([
      { id: "contact-a", tenantId: userA.tenantId, name: "A", phone: "1", email: null, company: null, status: "ACTIVE", lastContactedAt: null, createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { id: "contact-b", tenantId: userB.tenantId, name: "B", phone: "2", email: null, company: null, status: "ACTIVE", lastContactedAt: null, createdAt: new Date("2026-01-01T00:00:00.000Z") }
    ]);
    seedMessages([
      {
        tenantId: userB.tenantId,
        contactId: "contact-b",
        channel: "email",
        direction: "in",
        content: "Private",
        createdAt: new Date("2026-06-30T10:00:00.000Z")
      }
    ]);

    const crossTenantThread = await request(app)
      .get("/inbox/contact-b")
      .set("Cookie", [`access_token=${signAccessToken({ userId: userA.id, tenantId: userA.tenantId })}`]);

    expect(crossTenantThread.status).toBe(404);

    const inboxResponse = await request(app)
      .get("/inbox")
      .set("Cookie", [`access_token=${signAccessToken({ userId: userA.id, tenantId: userA.tenantId })}`]);

    expect(inboxResponse.body).toHaveLength(0);
  });
});