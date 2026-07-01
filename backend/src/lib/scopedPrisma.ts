import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";

type TenantScopedWhere = {
  tenantId: string;
};

type ScopedCreateData<TData> = TData extends object ? Omit<TData, "tenantId"> : TData;

const withTenantWhere = <TWhere extends object | undefined>(
  tenantId: string,
  where?: TWhere
): TWhere extends object ? TWhere & TenantScopedWhere : TenantScopedWhere =>
  ({
    ...(where ?? {}),
    tenantId
  }) as TWhere extends object ? TWhere & TenantScopedWhere : TenantScopedWhere;

const withTenantData = <TData extends object>(
  tenantId: string,
  data: TData
): Omit<TData, "tenantId"> & TenantScopedWhere =>
  ({
    ...data,
    tenantId
  }) as Omit<TData, "tenantId"> & TenantScopedWhere;

const scopedAuditLog = (tenantId: string) => ({
  findMany(args?: Prisma.AuditLogFindManyArgs) {
    return prisma.auditLog.findMany({
      ...args,
      where: withTenantWhere(tenantId, args?.where)
    });
  },
  findFirst(args?: Prisma.AuditLogFindFirstArgs) {
    return prisma.auditLog.findFirst({
      ...args,
      where: withTenantWhere(tenantId, args?.where)
    });
  },
  count(args?: Prisma.AuditLogCountArgs) {
    return prisma.auditLog.count({
      ...args,
      where: withTenantWhere(tenantId, args?.where)
    });
  },
  create(
    args: Omit<Prisma.AuditLogCreateArgs, "data"> & {
      data: Omit<Prisma.AuditLogUncheckedCreateInput, "tenantId">;
    }
  ) {
    return prisma.auditLog.create({
      ...args,
      data: withTenantData(tenantId, args.data) as Prisma.AuditLogUncheckedCreateInput
    });
  },
  updateMany(args: Prisma.AuditLogUpdateManyArgs) {
    return prisma.auditLog.updateMany({
      ...args,
      where: withTenantWhere(tenantId, args.where),
      data: {
        ...args.data,
        tenantId
      }
    } as Prisma.AuditLogUpdateManyArgs);
  },
  deleteMany(args?: Prisma.AuditLogDeleteManyArgs) {
    return prisma.auditLog.deleteMany({
      ...args,
      where: withTenantWhere(tenantId, args?.where)
    } as Prisma.AuditLogDeleteManyArgs);
  }
});

export const scopedPrisma = (tenantId: string) => {
  // Tenant identity must never be accepted from req.body, req.params, req.query,
  // or headers. Those values are controlled by the caller and can be forged.
  // The only trusted source of tenant context is req.auth, which is attached by
  // requireAuth after verifying a server-issued JWT. This helper turns that
  // trusted tenantId into a hard Prisma boundary so future CRM, inbox, AI, and
  // dashboard code cannot accidentally read or write across tenants.
  const contact = {
    findMany(args?: Prisma.ContactFindManyArgs) {
      return prisma.contact.findMany({
        ...args,
        where: withTenantWhere(tenantId, args?.where)
      });
    },
    findFirst(args?: Prisma.ContactFindFirstArgs) {
      return prisma.contact.findFirst({
        ...args,
        where: withTenantWhere(tenantId, args?.where)
      });
    },
    count(args?: Prisma.ContactCountArgs) {
      return prisma.contact.count({
        ...args,
        where: withTenantWhere(tenantId, args?.where)
      });
    },
    create(
      args: Omit<Prisma.ContactCreateArgs, "data"> & {
        data: Omit<Prisma.ContactUncheckedCreateInput, "tenantId">;
      }
    ) {
      return prisma.contact.create({
        ...args,
        data: withTenantData(tenantId, args.data) as Prisma.ContactUncheckedCreateInput
      });
    },
    updateMany(args: Prisma.ContactUpdateManyArgs) {
      return prisma.contact.updateMany({
        ...args,
        where: withTenantWhere(tenantId, args.where),
        data: {
          ...args.data,
          tenantId
        }
      });
    },
    deleteMany(args?: Prisma.ContactDeleteManyArgs) {
      return prisma.contact.deleteMany({
        ...args,
        where: withTenantWhere(tenantId, args?.where)
      });
    }
  };

  const opportunity = {
    findMany(args?: Prisma.OpportunityFindManyArgs) {
      return prisma.opportunity.findMany({
        ...args,
        where: withTenantWhere(tenantId, args?.where)
      });
    },
    findFirst(args?: Prisma.OpportunityFindFirstArgs) {
      return prisma.opportunity.findFirst({
        ...args,
        where: withTenantWhere(tenantId, args?.where)
      });
    },
    count(args?: Prisma.OpportunityCountArgs) {
      return prisma.opportunity.count({
        ...args,
        where: withTenantWhere(tenantId, args?.where)
      });
    },
    create(
      args: Omit<Prisma.OpportunityCreateArgs, "data"> & {
        data: Omit<Prisma.OpportunityUncheckedCreateInput, "tenantId">;
      }
    ) {
      return prisma.opportunity.create({
        ...args,
        data: withTenantData(tenantId, args.data) as Prisma.OpportunityUncheckedCreateInput
      });
    },
    updateMany(args: Prisma.OpportunityUpdateManyArgs) {
      return prisma.opportunity.updateMany({
        ...args,
        where: withTenantWhere(tenantId, args.where),
        data: {
          ...args.data,
          tenantId
        }
      });
    },
    deleteMany(args?: Prisma.OpportunityDeleteManyArgs) {
      return prisma.opportunity.deleteMany({
        ...args,
        where: withTenantWhere(tenantId, args?.where)
      });
    }
  };

  const task = {
    findMany(args?: Prisma.TaskFindManyArgs) {
      return prisma.task.findMany({
        ...args,
        where: withTenantWhere(tenantId, args?.where)
      });
    },
    findFirst(args?: Prisma.TaskFindFirstArgs) {
      return prisma.task.findFirst({
        ...args,
        where: withTenantWhere(tenantId, args?.where)
      });
    },
    count(args?: Prisma.TaskCountArgs) {
      return prisma.task.count({
        ...args,
        where: withTenantWhere(tenantId, args?.where)
      });
    },
    create(
      args: Omit<Prisma.TaskCreateArgs, "data"> & {
        data: Omit<Prisma.TaskUncheckedCreateInput, "tenantId">;
      }
    ) {
      return prisma.task.create({
        ...args,
        data: withTenantData(tenantId, args.data) as Prisma.TaskUncheckedCreateInput
      });
    },
    updateMany(args: Prisma.TaskUpdateManyArgs) {
      return prisma.task.updateMany({
        ...args,
        where: withTenantWhere(tenantId, args.where),
        data: {
          ...args.data,
          tenantId
        }
      });
    },
    deleteMany(args?: Prisma.TaskDeleteManyArgs) {
      return prisma.task.deleteMany({
        ...args,
        where: withTenantWhere(tenantId, args?.where)
      });
    }
  };

  return {
    contact,
    opportunity,
    task,
    auditLog: scopedAuditLog(tenantId)
  };
};