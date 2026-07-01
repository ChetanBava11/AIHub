import type { Prisma, OpportunityStage } from "@prisma/client";
import { AppError } from "../lib/errors";
import { logAudit } from "../lib/auditLogger";
import { scopedPrisma } from "../lib/scopedPrisma";
import { InboxMessage, type InboxMessageDocument } from "../models/InboxMessage";

export type CreateOpportunityInput = {
  contactId: string;
  title: string;
  value: number;
  stage: OpportunityStage;
  aiNextBestAction?: string;
};

export type UpdateOpportunityInput = Partial<CreateOpportunityInput>;

type OpportunityRecord = Prisma.OpportunityGetPayload<{
  include: {
    contact: true;
  };
}>;

type OpportunityAuditShape = {
  id: string;
  tenantId: string;
  contactId: string;
  title: string;
  value: Prisma.Decimal;
  stage: OpportunityStage;
  aiNextBestAction: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const toAuditOpportunity = (opportunity: OpportunityAuditShape) => ({
  id: opportunity.id,
  tenantId: opportunity.tenantId,
  contactId: opportunity.contactId,
  title: opportunity.title,
  value: opportunity.value.toString(),
  stage: opportunity.stage,
  aiNextBestAction: opportunity.aiNextBestAction,
  createdAt: opportunity.createdAt.toISOString(),
  updatedAt: opportunity.updatedAt.toISOString()
});

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

const toAuditMessage = (message: InboxMessageDocument) => ({
  tenantId: message.tenantId,
  contactId: message.contactId,
  channel: message.channel,
  direction: message.direction,
  content: message.content,
  sentiment: message.sentiment ?? null,
  intent: message.intent ?? null,
  summary: message.summary ?? null,
  createdAt: message.createdAt.toISOString()
});

const getTenantContact = async (tenantId: string, contactId: string) => {
  return scopedPrisma(tenantId).contact.findFirst({
    where: {
      id: contactId
    }
  });
};

export class OpportunityService {
  async listOpportunities(tenantId: string, stage?: OpportunityStage) {
    const where = stage ? { stage } : undefined;

    const [data, count] = await Promise.all([
      scopedPrisma(tenantId).opportunity.findMany({
        where,
        orderBy: {
          createdAt: "desc"
        }
      }),
      scopedPrisma(tenantId).opportunity.count({ where })
    ]);

    return { data, count };
  }

  async getOpportunityById(tenantId: string, id: string) {
    const opportunity = await scopedPrisma(tenantId).opportunity.findFirst({
      where: {
        id
      }
    });

    if (!opportunity) {
      throw new AppError("Opportunity not found.", 404);
    }

    const contact = await getTenantContact(tenantId, opportunity.contactId);

    if (!contact) {
      throw new AppError("Opportunity contact not found.", 404);
    }

    const recentMessages = await InboxMessage.find({
      tenantId,
      contactId: opportunity.contactId
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .exec();

    return {
      opportunity: {
        ...opportunity,
        contact
      },
      recentMessages: recentMessages.map(toAuditMessage)
    };
  }

  async createOpportunity(tenantId: string, userId: string, input: CreateOpportunityInput) {
    const contact = await getTenantContact(tenantId, input.contactId);

    if (!contact) {
      throw new AppError("Contact not found or not accessible.", 403);
    }

    try {
      const opportunity = await scopedPrisma(tenantId).opportunity.create({
        data: {
          contactId: input.contactId,
          title: input.title,
          value: input.value,
          stage: input.stage,
          aiNextBestAction: input.aiNextBestAction
        }
      });

      await logAudit({
        tenantId,
        userId,
        action: "OPPORTUNITY_CREATED",
        details: {
          opportunity: toAuditOpportunity(opportunity),
          contact: toAuditContact(contact)
        }
      });

      return opportunity;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Unable to create opportunity.", 500);
    }
  }

  async updateOpportunity(tenantId: string, userId: string, id: string, input: UpdateOpportunityInput) {
    const existingOpportunity = await scopedPrisma(tenantId).opportunity.findFirst({
      where: {
        id
      }
    });

    if (!existingOpportunity) {
      throw new AppError("Opportunity not found.", 404);
    }

    let nextContact: Awaited<ReturnType<typeof getTenantContact>> | undefined;

    if (input.contactId && input.contactId !== existingOpportunity.contactId) {
      nextContact = await getTenantContact(tenantId, input.contactId);

      if (!nextContact) {
        throw new AppError("Contact not found or not accessible.", 403);
      }
    }

    try {
      await scopedPrisma(tenantId).opportunity.updateMany({
        where: {
          id
        },
        data: {
          ...input
        }
      });

      const updatedOpportunity = await scopedPrisma(tenantId).opportunity.findFirst({
        where: {
          id
        }
      });

      if (!updatedOpportunity) {
        throw new AppError("Opportunity not found.", 404);
      }

      const updatedContact = nextContact ?? (await getTenantContact(tenantId, updatedOpportunity.contactId));

      if (!updatedContact) {
        throw new AppError("Opportunity contact not found.", 404);
      }

      await logAudit({
        tenantId,
        userId,
        action: "OPPORTUNITY_UPDATED",
        details: {
          before: toAuditOpportunity(existingOpportunity),
          after: toAuditOpportunity(updatedOpportunity),
          contact: toAuditContact(updatedContact)
        }
      });

      return updatedOpportunity;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Unable to update opportunity.", 500);
    }
  }

  async deleteOpportunity(tenantId: string, userId: string, id: string) {
    const existingOpportunity = await scopedPrisma(tenantId).opportunity.findFirst({
      where: {
        id
      }
    });

    if (!existingOpportunity) {
      throw new AppError("Opportunity not found.", 404);
    }

    try {
      await scopedPrisma(tenantId).opportunity.deleteMany({
        where: {
          id
        }
      });

      await logAudit({
        tenantId,
        userId,
        action: "OPPORTUNITY_DELETED",
        details: {
          opportunity: toAuditOpportunity(existingOpportunity)
        }
      });

      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Unable to delete opportunity.", 500);
    }
  }
}