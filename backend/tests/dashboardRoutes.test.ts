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
  const opportunityStore = new Map<string, OpportunityRecord>();
  const taskStore = new Map<string, TaskRecord>();

  const mockContactDelegate = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(async (args?: { where?: { tenantId?: string } }) =>
      Array.from(contactStore.values()).filter((contact) => contact.tenantId === args?.where?.tenantId).length
    ),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  };

  const mockOpportunityDelegate = {
    findMany: jest.fn(async (args?: { where?: { tenantId?: string; stage?: { notIn?: string[] } } }) => {
      const tenantId = args?.where?.tenantId;
      const excludedStages = args?.where?.stage?.notIn ?? [];

      return Array.from(opportunityStore.values()).filter(
        (opportunity) =>
          opportunity.tenantId === tenantId && !excludedStages.includes(opportunity.stage)
      );
    }),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  };

  const mockTaskDelegate = {
    findMany: jest.fn(async (args?: { where?: { tenantId?: string; completed?: boolean } }) => {
      const tenantId = args?.where?.tenantId;
      const completed = args?.where?.completed;

      return Array.from(taskStore.values()).filter(
        (task) => task.tenantId === tenantId && (completed === undefined ? true : task.completed === completed)
      );
    }),
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
    seedContacts: (contacts: ContactRecord[]) => {
      contactStore.clear();
      contacts.forEach((contact) => contactStore.set(contact.id, contact));
    },
    seedOpportunities: (opportunities: OpportunityRecord[]) => {
      opportunityStore.clear();
      opportunities.forEach((opportunity) => opportunityStore.set(opportunity.id, opportunity));
    },
    seedTasks: (tasks: TaskRecord[]) => {
      taskStore.clear();
      tasks.forEach((task) => taskStore.set(task.id, task));
    },
    resetStores: () => {
      contactStore.clear();
      opportunityStore.clear();
      taskStore.clear();
    }
  };
});

const prismaMocks = require("../src/prisma/client") as {
  seedContacts: (contacts: Array<Record<string, unknown>>) => void;
  seedOpportunities: (opportunities: Array<Record<string, unknown>>) => void;
  seedTasks: (tasks: Array<Record<string, unknown>>) => void;
  resetStores: () => void;
};

const { seedContacts, seedOpportunities, seedTasks, resetStores } = prismaMocks;

describe("dashboard routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
  });

  it("returns tenant-scoped KPI totals", async () => {
    const { app, authRepository } = createTestHarness();
    const { user: userA } = await authRepository.upsertGoogleUser({
      googleId: "google-dashboard-a",
      email: "a@example.com",
      name: "Tenant A"
    });
    const { user: userB } = await authRepository.upsertGoogleUser({
      googleId: "google-dashboard-b",
      email: "b@example.com",
      name: "Tenant B"
    });

    seedContacts([
      { id: "contact-a1", tenantId: userA.tenantId, name: "A1", phone: "1", email: null, company: null, status: "ACTIVE", lastContactedAt: null, createdAt: new Date() },
      { id: "contact-a2", tenantId: userA.tenantId, name: "A2", phone: "2", email: null, company: null, status: "ACTIVE", lastContactedAt: null, createdAt: new Date() },
      { id: "contact-b1", tenantId: userB.tenantId, name: "B1", phone: "3", email: null, company: null, status: "ACTIVE", lastContactedAt: null, createdAt: new Date() }
    ]);

    seedOpportunities([
      { id: "opp-a1", tenantId: userA.tenantId, contactId: "contact-a1", title: "Pipeline 1", value: 1000, stage: "NEW", aiNextBestAction: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "opp-a2", tenantId: userA.tenantId, contactId: "contact-a2", title: "Won 1", value: 5000, stage: "WON", aiNextBestAction: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "opp-a3", tenantId: userA.tenantId, contactId: "contact-a1", title: "Proposal 1", value: 2500, stage: "PROPOSAL", aiNextBestAction: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "opp-b1", tenantId: userB.tenantId, contactId: "contact-b1", title: "B pipeline", value: 8000, stage: "NEW", aiNextBestAction: null, createdAt: new Date(), updatedAt: new Date() }
    ]);

    seedTasks([
      { id: "task-a1", tenantId: userA.tenantId, contactId: "contact-a1", description: "Open 1", dueDate: new Date(), completed: false, createdAt: new Date() },
      { id: "task-a2", tenantId: userA.tenantId, contactId: "contact-a1", description: "Done 1", dueDate: new Date(), completed: true, createdAt: new Date() },
      { id: "task-b1", tenantId: userB.tenantId, contactId: "contact-b1", description: "Open B", dueDate: new Date(), completed: false, createdAt: new Date() }
    ]);

    const response = await request(app)
      .get("/dashboard/kpis")
      .set("Cookie", [`access_token=${signAccessToken({ userId: userA.id, tenantId: userA.tenantId })}`]);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      activeOpportunitiesCount: 2,
      revenuePipelineSum: 3500,
      pendingFollowupsCount: 1,
      customerActivityCount: 2,
      aiAlertsCount: 0
    });
  });

  it("ignores other tenant data", async () => {
    const { app, authRepository } = createTestHarness();
    const { user: userA } = await authRepository.upsertGoogleUser({
      googleId: "google-dashboard-tenant-a",
      email: "a@example.com",
      name: "Tenant A"
    });
    const { user: userB } = await authRepository.upsertGoogleUser({
      googleId: "google-dashboard-tenant-b",
      email: "b@example.com",
      name: "Tenant B"
    });

    seedContacts([
      { id: "contact-a", tenantId: userA.tenantId, name: "A", phone: "1", email: null, company: null, status: "ACTIVE", lastContactedAt: null, createdAt: new Date() },
      { id: "contact-b", tenantId: userB.tenantId, name: "B", phone: "2", email: null, company: null, status: "ACTIVE", lastContactedAt: null, createdAt: new Date() }
    ]);

    seedOpportunities([
      { id: "opp-a", tenantId: userA.tenantId, contactId: "contact-a", title: "A", value: 100, stage: "NEW", aiNextBestAction: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "opp-b", tenantId: userB.tenantId, contactId: "contact-b", title: "B", value: 9999, stage: "NEW", aiNextBestAction: null, createdAt: new Date(), updatedAt: new Date() }
    ]);

    seedTasks([
      { id: "task-a", tenantId: userA.tenantId, contactId: "contact-a", description: "A", dueDate: new Date(), completed: false, createdAt: new Date() },
      { id: "task-b", tenantId: userB.tenantId, contactId: "contact-b", description: "B", dueDate: new Date(), completed: false, createdAt: new Date() }
    ]);

    const response = await request(app)
      .get("/dashboard/kpis")
      .set("Cookie", [`access_token=${signAccessToken({ userId: userA.id, tenantId: userA.tenantId })}`]);

    expect(response.status).toBe(200);
    expect(response.body.activeOpportunitiesCount).toBe(1);
    expect(response.body.revenuePipelineSum).toBe(100);
    expect(response.body.pendingFollowupsCount).toBe(1);
    expect(response.body.customerActivityCount).toBe(1);
  });
});