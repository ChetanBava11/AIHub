import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";

export const logAudit = async (input: {
  tenantId: string;
  userId?: string;
  action: string;
  details?: Prisma.InputJsonValue;
}) => {
  return prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      action: input.action,
      details: input.details
    }
  });
};