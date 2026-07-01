const mockContactDelegate = {
  findMany: jest.fn(),
  findFirst: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
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
  findMany: jest.fn(),
  findFirst: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  updateMany: jest.fn(),
  deleteMany: jest.fn()
};

jest.mock("../src/prisma/client", () => ({
  prisma: {
    contact: mockContactDelegate,
    opportunity: mockOpportunityDelegate,
    task: mockTaskDelegate,
    auditLog: mockAuditLogDelegate
  }
}));

import { scopedPrisma } from "../src/lib/scopedPrisma";

describe("scopedPrisma", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockContactDelegate.findMany.mockResolvedValue([]);
    mockContactDelegate.findFirst.mockResolvedValue(null);
    mockContactDelegate.count.mockResolvedValue(0);
    mockContactDelegate.create.mockResolvedValue({});
    mockContactDelegate.updateMany.mockResolvedValue({ count: 0 });
    mockContactDelegate.deleteMany.mockResolvedValue({ count: 0 });

    mockAuditLogDelegate.create.mockResolvedValue({});
  });

  it("overrides any tenant-like filters with the authenticated tenant", async () => {
    const db = scopedPrisma("tenant-a");

    await db.contact.findMany({
      where: {
        tenantId: "tenant-b",
        name: { contains: "Acme" }
      }
    });

    await db.contact.findFirst({
      where: {
        tenantId: "tenant-b",
        id: "contact-b"
      }
    });

    await db.contact.create({
      data: {
        name: "Alice",
        phone: "555-0100",
        status: "ACTIVE"
      }
    });

    await db.contact.updateMany({
      where: {
        tenantId: "tenant-b",
        id: "contact-b"
      },
      data: {
        status: "INACTIVE"
      }
    });

    expect(mockContactDelegate.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        name: { contains: "Acme" }
      }
    });

    expect(mockContactDelegate.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        id: "contact-b"
      }
    });

    expect(mockContactDelegate.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-a",
        name: "Alice",
        phone: "555-0100",
        status: "ACTIVE"
      }
    });

    expect(mockContactDelegate.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        id: "contact-b"
      },
      data: {
        status: "INACTIVE",
        tenantId: "tenant-a"
      }
    });
  });

  it("scopes audit log writes to the active tenant", async () => {
    const db = scopedPrisma("tenant-a");

    await db.auditLog.create({
      data: {
        tenantId: "tenant-b",
        action: "audit.test"
      }
    } as never);

    expect(mockAuditLogDelegate.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-a",
        action: "audit.test"
      }
    });
  });
});