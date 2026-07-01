import { createTask, fetchBusinessMetrics, sendWhatsApp, searchContacts, updateOpportunity } from "../src/tools";
import { logAudit } from "../src/lib/auditLogger";
import { scopedPrisma } from "../src/lib/scopedPrisma";
import { DashboardService } from "../src/services/dashboardService";
import { InboxMessage } from "../src/models/InboxMessage";

jest.mock("../src/lib/auditLogger", () => ({
  logAudit: jest.fn()
}));

jest.mock("../src/lib/scopedPrisma", () => ({
  scopedPrisma: jest.fn()
}));

jest.mock("../src/services/dashboardService", () => ({
  DashboardService: jest.fn().mockImplementation(() => ({
    getKpis: jest.fn()
  }))
}));

jest.mock("../src/models/InboxMessage", () => ({
  InboxMessage: {
    create: jest.fn()
  }
}));

describe("AI tool modules", () => {
  const mockedLogAudit = logAudit as jest.MockedFunction<typeof logAudit>;
  const mockedScopedPrisma = scopedPrisma as jest.MockedFunction<typeof scopedPrisma>;
  const MockedDashboardService = DashboardService as jest.MockedClass<typeof DashboardService>;
  const mockedInboxCreate = InboxMessage.create as jest.MockedFunction<(...args: Array<unknown>) => Promise<unknown>>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("searchContacts returns matching contacts and logs resultCount", async () => {
    const fakeContacts = [
      {
        id: "contact-1",
        name: "Rahul Mehta",
        phone: "555-0101",
        email: "rahul@example.com",
        company: "Alpha Co",
        status: "ACTIVE",
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ];

    const mockContactDelegate = {
      findMany: jest.fn().mockResolvedValue(fakeContacts)
    };
    mockedScopedPrisma.mockReturnValue({ contact: mockContactDelegate } as any);

    const results = await searchContacts({
      tenantId: "tenant-a",
      userId: "user-1",
      query: "Rahul"
    });

    expect(results).toEqual(fakeContacts);
    expect(mockContactDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array)
        }),
        orderBy: { createdAt: "desc" },
        take: 10,
        select: expect.any(Object)
      })
    );
    expect(mockedLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        userId: "user-1",
        action: "AI_TOOL_SEARCH_CONTACTS",
        details: {
          query: "Rahul",
          resultCount: 1
        }
      })
    );
  });

  it("createTask creates a task and logs minimal audit details", async () => {
    const mockContactDelegate = {
      findFirst: jest.fn().mockResolvedValue({ id: "contact-1" })
    };
    const mockTaskDelegate = {
      create: jest.fn().mockResolvedValue({
        id: "task-1",
        contactId: "contact-1",
        description: "Follow up",
        dueDate: new Date("2026-07-01T00:00:00.000Z")
      })
    };

    mockedScopedPrisma.mockReturnValue({
      contact: mockContactDelegate,
      task: mockTaskDelegate
    } as any);

    const task = await createTask({
      tenantId: "tenant-a",
      userId: "user-1",
      contactId: "contact-1",
      description: "Follow up",
      dueDate: "2026-07-01T00:00:00.000Z"
    });

    expect(task).toEqual({
      id: "task-1",
      contactId: "contact-1",
      description: "Follow up",
      dueDate: new Date("2026-07-01T00:00:00.000Z")
    });
    expect(mockContactDelegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "contact-1" } })
    );
    expect(mockTaskDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactId: "contact-1",
          description: "Follow up",
          dueDate: new Date("2026-07-01T00:00:00.000Z")
        })
      })
    );
    expect(mockedLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        userId: "user-1",
        action: "AI_TOOL_CREATE_TASK",
        details: {
          contactId: "contact-1",
          taskId: "task-1",
          dueDate: "2026-07-01T00:00:00.000Z"
        }
      })
    );
  });

  it("updateOpportunity updates same tenant and logs audit details", async () => {
    const existingOpportunity = {
      id: "opp-1",
      tenantId: "tenant-a",
      stage: "NEW",
      value: 1000,
      aiNextBestAction: null
    };
    const updatedOpportunity = {
      ...existingOpportunity,
      stage: "QUALIFIED",
      value: 5000,
      aiNextBestAction: "Raise stage"
    };

    const mockOpportunityDelegate = {
      findFirst: jest.fn()
        .mockResolvedValueOnce(existingOpportunity)
        .mockResolvedValueOnce(updatedOpportunity),
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
    };

    mockedScopedPrisma.mockReturnValue({ opportunity: mockOpportunityDelegate } as any);

    const result = await updateOpportunity({
      tenantId: "tenant-a",
      userId: "user-1",
      opportunityId: "opp-1",
      stage: "QUALIFIED",
      value: 5000,
      aiReasoning: "Raise stage"
    });

    expect(result).toEqual(updatedOpportunity);
    expect(mockOpportunityDelegate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "opp-1" },
        data: {
          stage: "QUALIFIED",
          value: 5000,
          aiNextBestAction: "Raise stage"
        }
      })
    );
    expect(mockedLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        userId: "user-1",
        action: "AI_TOOL_UPDATE_OPPORTUNITY",
        details: {
          opportunityId: "opp-1",
          previousStage: "NEW",
          newStage: "QUALIFIED",
          updatedValue: 5000
        }
      })
    );
  });

  it("rejects cross-tenant opportunity updates", async () => {
    const mockOpportunityDelegate = {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn()
    };

    mockedScopedPrisma.mockReturnValue({ opportunity: mockOpportunityDelegate } as any);

    await expect(
      updateOpportunity({
        tenantId: "tenant-b",
        userId: "user-1",
        opportunityId: "opp-1",
        stage: "QUALIFIED",
        aiReasoning: "Update attempt"
      })
    ).rejects.toThrow("Opportunity not found.");

    expect(mockOpportunityDelegate.updateMany).not.toHaveBeenCalled();
  });

  it("fetchBusinessMetrics returns dashboard KPIs and logs requestedBy", async () => {
    const metrics = {
      activeOpportunitiesCount: 4,
      revenuePipelineSum: 12000,
      pendingFollowupsCount: 2,
      customerActivityCount: 5,
      aiAlertsCount: 0
    };

    const mockGetKpis = jest.fn().mockResolvedValue(metrics);
    MockedDashboardService.mockImplementation(() => ({ getKpis: mockGetKpis } as any));

    const result = await fetchBusinessMetrics({
      tenantId: "tenant-a",
      userId: "user-1"
    });

    expect(result).toEqual(metrics);
    expect(mockGetKpis).toHaveBeenCalledWith("tenant-a");
    expect(mockedLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "AI_TOOL_FETCH_BUSINESS_METRICS",
        details: {
          requestedBy: "user-1"
        }
      })
    );
  });

  it("sendWhatsApp returns mock success, persists an inbox message, and logs audit details", async () => {
    const mockContactDelegate = {
      findFirst: jest.fn().mockResolvedValue({
        id: "contact-1",
        phone: "555-0101"
      })
    };
    mockedScopedPrisma.mockReturnValue({ contact: mockContactDelegate } as any);
    mockedInboxCreate.mockResolvedValue({});

    const result = await sendWhatsApp({
      tenantId: "tenant-a",
      userId: "user-1",
      contactId: "contact-1",
      message: "Hello"
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        mock: true,
        timestamp: expect.any(Date)
      })
    );
    expect(mockedInboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        contactId: "contact-1",
        channel: "whatsapp",
        direction: "out",
        content: "Hello"
      })
    );
    expect(mockedLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "AI_TOOL_SEND_WHATSAPP",
        details: {
          contactId: "contact-1",
          messageLength: 5,
          mockMode: true
        }
      })
    );
  });
});
