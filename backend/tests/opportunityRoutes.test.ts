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

  type OpportunityRecord = {
    id: string;
    tenantId: string;
    contactId: string;
    title: string;
    value: number;
    stage: "NEW" | "QUALIFIED" | "PROPOSAL" | "WON" | "LOST";
    aiNextBestAction: string | null;
    createdAt: Date;
    updatedAt: Date;
  };

  const contactStore = new Map<string, ContactRecord>();
  const opportunityStore = new Map<string, OpportunityRecord>();

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
    create: jest.fn(async (args?: { data?: Partial<ContactRecord> & { tenantId?: string } }) => {
      const record: ContactRecord = {
        id: `contact-${contactStore.size + 1}`,
        tenantId: args?.data?.tenantId ?? "",
        name: String(args?.data?.name ?? ""),
        phone: String(args?.data?.phone ?? ""),
        email: (args?.data?.email as string | undefined) ?? null,
        company: (args?.data?.company as string | undefined) ?? null,
        status: String(args?.data?.status ?? ""),
        lastContactedAt: (args?.data?.lastContactedAt as Date | undefined) ?? null,
        createdAt: new Date()
      };

      contactStore.set(record.id, record);
      return record;
    }),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  };

  const mockOpportunityDelegate = {
    findMany: jest.fn(async (args?: { where?: { tenantId?: string; stage?: string } }) => {
      const tenantId = args?.where?.tenantId;
      const stage = args?.where?.stage;

      return Array.from(opportunityStore.values())
        .filter((opportunity) => opportunity.tenantId === tenantId)
        .filter((opportunity) => (stage ? opportunity.stage === stage : true))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    }),
    findFirst: jest.fn(async (args?: { where?: { tenantId?: string; id?: string } }) => {
      const tenantId = args?.where?.tenantId;
      const id = args?.where?.id;
      const opportunity = id ? opportunityStore.get(id) : undefined;

      if (!opportunity || opportunity.tenantId !== tenantId) {
        return null;
      }

      return opportunity;
    }),
    count: jest.fn(async (args?: { where?: { tenantId?: string; stage?: string } }) => {
      const tenantId = args?.where?.tenantId;
      const stage = args?.where?.stage;

      return Array.from(opportunityStore.values()).filter(
        (opportunity) => opportunity.tenantId === tenantId && (stage ? opportunity.stage === stage : true)
      ).length;
    }),
    create: jest.fn(async (args?: { data?: Partial<OpportunityRecord> & { tenantId?: string; contactId?: string } }) => {
      const now = new Date();
      const record: OpportunityRecord = {
        id: `opportunity-${opportunityStore.size + 1}`,
        tenantId: args?.data?.tenantId ?? "",
        contactId: String(args?.data?.contactId ?? ""),
        title: String(args?.data?.title ?? ""),
        value: Number(args?.data?.value ?? 0),
        stage: (args?.data?.stage as OpportunityRecord["stage"]) ?? "NEW",
        aiNextBestAction: (args?.data?.aiNextBestAction as string | undefined) ?? null,
        createdAt: now,
        updatedAt: now
      };

      opportunityStore.set(record.id, record);
      return record;
    }),
    updateMany: jest.fn(async (args?: { where?: { tenantId?: string; id?: string }; data?: Partial<OpportunityRecord> }) => {
      const tenantId = args?.where?.tenantId;
      const id = args?.where?.id;
      const opportunity = id ? opportunityStore.get(id) : undefined;

      if (!opportunity || opportunity.tenantId !== tenantId) {
        return { count: 0 };
      }

      const updated: OpportunityRecord = {
        ...opportunity,
        ...args?.data,
        tenantId: opportunity.tenantId,
        contactId: String(args?.data?.contactId ?? opportunity.contactId),
        title: String(args?.data?.title ?? opportunity.title),
        value: args?.data?.value !== undefined ? Number(args.data.value) : opportunity.value,
        stage: (args?.data?.stage as OpportunityRecord["stage"] | undefined) ?? opportunity.stage,
        aiNextBestAction:
          args?.data?.aiNextBestAction !== undefined
            ? ((args.data.aiNextBestAction as string | undefined) ?? null)
            : opportunity.aiNextBestAction,
        createdAt: opportunity.createdAt,
        updatedAt: new Date()
      };

      opportunityStore.set(id!, updated);
      return { count: 1 };
    }),
    deleteMany: jest.fn(async (args?: { where?: { tenantId?: string; id?: string } }) => {
      const tenantId = args?.where?.tenantId;
      const id = args?.where?.id;
      const opportunity = id ? opportunityStore.get(id) : undefined;

      if (!opportunity || opportunity.tenantId !== tenantId) {
        return { count: 0 };
      }

      opportunityStore.delete(id!);
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
      opportunity: mockOpportunityDelegate,
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
    mockOpportunityDelegate,
    mockAuditLogDelegate,
    seedContacts: (contacts: ContactRecord[]) => {
      contactStore.clear();
      contacts.forEach((contact) => contactStore.set(contact.id, contact));
    },
    seedOpportunities: (opportunities: OpportunityRecord[]) => {
      opportunityStore.clear();
      opportunities.forEach((opportunity) => opportunityStore.set(opportunity.id, opportunity));
    },
    resetStores: () => {
      contactStore.clear();
      opportunityStore.clear();
    }
  };
});

jest.mock("../src/models/InboxMessage", () => {
  type MessageRecord = {
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

  const messageStore = new Map<string, MessageRecord>();

  const buildChain = (messages: MessageRecord[]) => ({
    sort: () => ({
      limit: (limitCount: number) => ({
        exec: async () => messages.slice(0, limitCount)
      })
    })
  });

  return {
    InboxMessage: {
      find: jest.fn((filter: { tenantId?: string; contactId?: string }) => {
        const messages = Array.from(messageStore.values())
          .filter((message) => message.tenantId === filter.tenantId && message.contactId === filter.contactId)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

        return buildChain(messages);
      })
    },
    seedMessages: (messages: Array<{ id: string } & MessageRecord>) => {
      messageStore.clear();
      messages.forEach(({ id: _id, ...message }) => {
        const key = `${message.tenantId}:${message.contactId}:${message.createdAt.toISOString()}:${message.content}`;
        messageStore.set(key, message);
      });
    },
    resetMessages: () => {
      messageStore.clear();
    }
  };
});

import { createTestHarness } from "./support/testApp";

const prismaMocks = require("../src/prisma/client") as {
  mockAuditLogDelegate: { create: jest.Mock };
  mockContactDelegate: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  mockOpportunityDelegate: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  seedContacts: (contacts: Array<Record<string, unknown>>) => void;
  seedOpportunities: (opportunities: Array<Record<string, unknown>>) => void;
  resetStores: () => void;
};

const inboxMocks = require("../src/models/InboxMessage") as {
  seedMessages: (messages: Array<Record<string, unknown>>) => void;
  resetMessages: () => void;
};

const { mockAuditLogDelegate, mockOpportunityDelegate, seedContacts, seedOpportunities, resetStores } = prismaMocks;
const { seedMessages, resetMessages } = inboxMocks;

describe("opportunities routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
    resetMessages();
  });

  const seedTenantData = (tenantId: string, contactId: string, contactName: string) => {
    seedContacts([
      {
        id: contactId,
        tenantId,
        name: contactName,
        phone: `555-${contactId.slice(-4)}`,
        email: `${contactId}@example.com`,
        company: "Acme",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ]);
  };

  it("returns opportunities for the authenticated tenant and supports stage filtering", async () => {
    const { app, authRepository } = createTestHarness();
    const { user: userA } = await authRepository.upsertGoogleUser({
      googleId: "google-opps-a",
      email: "a@example.com",
      name: "Tenant A"
    });
    const { user: userB } = await authRepository.upsertGoogleUser({
      googleId: "google-opps-b",
      email: "b@example.com",
      name: "Tenant B"
    });

    seedContacts([
      {
        id: "contact-a1",
        tenantId: userA.tenantId,
        name: "Alice",
        phone: "555-0001",
        email: "alice@example.com",
        company: "Alpha",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      },
      {
        id: "contact-b1",
        tenantId: userB.tenantId,
        name: "Bob",
        phone: "555-0002",
        email: "bob@example.com",
        company: "Beta",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ]);

    seedOpportunities([
      {
        id: "opportunity-a-new",
        tenantId: userA.tenantId,
        contactId: "contact-a1",
        title: "A New Deal",
        value: 1000,
        stage: "NEW",
        aiNextBestAction: null,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z")
      },
      {
        id: "opportunity-a-won",
        tenantId: userA.tenantId,
        contactId: "contact-a1",
        title: "A Won Deal",
        value: 2500,
        stage: "WON",
        aiNextBestAction: null,
        createdAt: new Date("2026-01-04T00:00:00.000Z"),
        updatedAt: new Date("2026-01-04T00:00:00.000Z")
      },
      {
        id: "opportunity-b-new",
        tenantId: userB.tenantId,
        contactId: "contact-b1",
        title: "B New Deal",
        value: 1500,
        stage: "NEW",
        aiNextBestAction: null,
        createdAt: new Date("2026-01-05T00:00:00.000Z"),
        updatedAt: new Date("2026-01-05T00:00:00.000Z")
      }
    ]);

    const response = await request(app)
      .get("/opportunities?stage=NEW")
      .set("Cookie", [`access_token=${signAccessToken({ userId: userA.id, tenantId: userA.tenantId })}`]);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe("opportunity-a-new");
  });

  it("creates an opportunity and writes an audit log", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-opps-create",
      email: "creator@example.com",
      name: "Creator"
    });

    seedTenantData(user.tenantId, "contact-create", "Creator Contact");

    const response = await request(app)
      .post("/opportunities")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`])
      .send({
        contactId: "contact-create",
        title: "New Opportunity",
        value: 3200,
        stage: "QUALIFIED"
      });

    expect(response.status).toBe(201);
    expect(response.body.opportunity.title).toBe("New Opportunity");
    expect(mockOpportunityDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactId: "contact-create",
          tenantId: user.tenantId,
          stage: "QUALIFIED"
        })
      })
    );
    expect(mockAuditLogDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: user.tenantId,
          userId: user.id,
          action: "OPPORTUNITY_CREATED"
        })
      })
    );
  });

  it("rejects an invalid contact when creating an opportunity", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-opps-invalid",
      email: "invalid@example.com",
      name: "Invalid"
    });

    const response = await request(app)
      .post("/opportunities")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`])
      .send({
        contactId: "missing-contact",
        title: "Invalid Opportunity",
        value: 100,
        stage: "NEW"
      });

    expect(response.status).toBe(403);
  });

  it("rejects a contact from another tenant when creating or updating", async () => {
    const { app, authRepository } = createTestHarness();
    const { user: userA } = await authRepository.upsertGoogleUser({
      googleId: "google-opps-cross-a",
      email: "a@example.com",
      name: "Tenant A"
    });
    const { user: userB } = await authRepository.upsertGoogleUser({
      googleId: "google-opps-cross-b",
      email: "b@example.com",
      name: "Tenant B"
    });

    seedContacts([
      {
        id: "contact-a",
        tenantId: userA.tenantId,
        name: "Tenant A Contact",
        phone: "555-1111",
        email: "a-contact@example.com",
        company: "Alpha",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      },
      {
        id: "contact-b",
        tenantId: userB.tenantId,
        name: "Tenant B Contact",
        phone: "555-2222",
        email: "b-contact@example.com",
        company: "Beta",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ]);

    seedOpportunities([
      {
        id: "opportunity-a",
        tenantId: userA.tenantId,
        contactId: "contact-a",
        title: "Tenant A Deal",
        value: 1000,
        stage: "NEW",
        aiNextBestAction: null,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z")
      }
    ]);

    const createResponse = await request(app)
      .post("/opportunities")
      .set("Cookie", [`access_token=${signAccessToken({ userId: userA.id, tenantId: userA.tenantId })}`])
      .send({
        contactId: "contact-b",
        title: "Cross Tenant",
        value: 500,
        stage: "NEW"
      });

    expect(createResponse.status).toBe(403);

    const updateResponse = await request(app)
      .put("/opportunities/opportunity-a")
      .set("Cookie", [`access_token=${signAccessToken({ userId: userA.id, tenantId: userA.tenantId })}`])
      .send({
        contactId: "contact-b"
      });

    expect(updateResponse.status).toBe(403);
  });

  it("returns one opportunity with related contact and recent inbox messages", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-opps-detail",
      email: "detail@example.com",
      name: "Detail User"
    });

    seedTenantData(user.tenantId, "contact-detail", "Detail Contact");
    seedOpportunities([
      {
        id: "opportunity-detail",
        tenantId: user.tenantId,
        contactId: "contact-detail",
        title: "Detailed Deal",
        value: 4200,
        stage: "PROPOSAL",
        aiNextBestAction: "Follow up tomorrow",
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        updatedAt: new Date("2026-01-04T00:00:00.000Z")
      }
    ]);

    seedMessages([
      {
        id: "m1",
        tenantId: user.tenantId,
        contactId: "contact-detail",
        channel: "email",
        direction: "in",
        content: "Message 1",
        sentiment: null,
        intent: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:01.000Z")
      },
      {
        id: "m2",
        tenantId: user.tenantId,
        contactId: "contact-detail",
        channel: "email",
        direction: "in",
        content: "Message 2",
        sentiment: null,
        intent: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:02.000Z")
      },
      {
        id: "m3",
        tenantId: user.tenantId,
        contactId: "contact-detail",
        channel: "email",
        direction: "in",
        content: "Message 3",
        sentiment: null,
        intent: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:03.000Z")
      },
      {
        id: "m4",
        tenantId: user.tenantId,
        contactId: "contact-detail",
        channel: "email",
        direction: "in",
        content: "Message 4",
        sentiment: null,
        intent: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:04.000Z")
      },
      {
        id: "m5",
        tenantId: user.tenantId,
        contactId: "contact-detail",
        channel: "email",
        direction: "in",
        content: "Message 5",
        sentiment: null,
        intent: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:05.000Z")
      },
      {
        id: "m6",
        tenantId: user.tenantId,
        contactId: "contact-detail",
        channel: "email",
        direction: "in",
        content: "Message 6",
        sentiment: null,
        intent: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:06.000Z")
      }
    ]);

    const response = await request(app)
      .get("/opportunities/opportunity-detail")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`]);

    expect(response.status).toBe(200);
    expect(response.body.opportunity.id).toBe("opportunity-detail");
    expect(response.body.opportunity.contact.id).toBe("contact-detail");
    expect(response.body.recentMessages).toHaveLength(5);
    expect(response.body.recentMessages[0].content).toBe("Message 6");
    expect(response.body.recentMessages[4].content).toBe("Message 2");
  });

  it("updates an opportunity and logs the change", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-opps-update",
      email: "update@example.com",
      name: "Updater"
    });

    seedContacts([
      {
        id: "contact-update-a",
        tenantId: user.tenantId,
        name: "Primary Contact",
        phone: "555-3001",
        email: "primary@example.com",
        company: "Acme",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      },
      {
        id: "contact-update-b",
        tenantId: user.tenantId,
        name: "Secondary Contact",
        phone: "555-3002",
        email: "secondary@example.com",
        company: "Acme",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-02T00:00:00.000Z")
      }
    ]);

    seedOpportunities([
      {
        id: "opportunity-update",
        tenantId: user.tenantId,
        contactId: "contact-update-a",
        title: "Original Title",
        value: 1200,
        stage: "NEW",
        aiNextBestAction: null,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z")
      }
    ]);

    const response = await request(app)
      .put("/opportunities/opportunity-update")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`])
      .send({
        title: "Updated Title",
        value: 2000,
        stage: "WON",
        aiNextBestAction: "Close the deal",
        contactId: "contact-update-b"
      });

    expect(response.status).toBe(200);
    expect(response.body.opportunity.title).toBe("Updated Title");
    expect(response.body.opportunity.contactId).toBe("contact-update-b");
    expect(mockOpportunityDelegate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: user.tenantId,
          id: "opportunity-update"
        })
      })
    );
    expect(mockAuditLogDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: user.tenantId,
          userId: user.id,
          action: "OPPORTUNITY_UPDATED"
        })
      })
    );
  });

  it("deletes an opportunity and logs the deletion", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-opps-delete",
      email: "delete@example.com",
      name: "Deleter"
    });

    seedContacts([
      {
        id: "contact-delete",
        tenantId: user.tenantId,
        name: "Delete Contact",
        phone: "555-4001",
        email: "delete@example.com",
        company: "Acme",
        status: "ACTIVE",
        lastContactedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ]);

    seedOpportunities([
      {
        id: "opportunity-delete",
        tenantId: user.tenantId,
        contactId: "contact-delete",
        title: "Delete Me",
        value: 500,
        stage: "NEW",
        aiNextBestAction: null,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z")
      }
    ]);

    const response = await request(app)
      .delete("/opportunities/opportunity-delete")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`]);

    expect(response.status).toBe(204);
    expect(mockOpportunityDelegate.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: user.tenantId,
          id: "opportunity-delete"
        })
      })
    );
    expect(mockAuditLogDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: user.tenantId,
          userId: user.id,
          action: "OPPORTUNITY_DELETED"
        })
      })
    );
  });

  it("returns 404 when the opportunity does not exist", async () => {
    const { app, authRepository } = createTestHarness();
    const { user } = await authRepository.upsertGoogleUser({
      googleId: "google-opps-missing",
      email: "missing@example.com",
      name: "Missing"
    });

    const response = await request(app)
      .get("/opportunities/non-existent")
      .set("Cookie", [`access_token=${signAccessToken({ userId: user.id, tenantId: user.tenantId })}`]);

    expect(response.status).toBe(404);
  });
});