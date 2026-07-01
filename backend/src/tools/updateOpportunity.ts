import { z } from "zod";
import type { OpportunityStage } from "@prisma/client";
import { AppError } from "../lib/errors";
import { logAudit } from "../lib/auditLogger";
import { scopedPrisma } from "../lib/scopedPrisma";
import type { UpdateOpportunityInput } from "./types";

const updateOpportunitySchema = z.object({
  tenantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  opportunityId: z.string().trim().min(1),
  stage: z.enum(["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const),
  value: z.number().optional(),
  aiReasoning: z.string().trim().min(1).optional()
});

export const updateOpportunity = async (
  arg1: UpdateOpportunityInput | string,
  userId?: string,
  opportunityId?: string,
  stage?: OpportunityStage,
  value?: number,
  aiReasoning?: string
) => {
  const payload =
    typeof arg1 === "string"
      ? updateOpportunitySchema.parse({
          tenantId: arg1,
          userId: userId ?? "",
          opportunityId: opportunityId ?? "",
          stage: stage ?? "NEW",
          value,
          aiReasoning
        })
      : updateOpportunitySchema.parse(arg1);

  return updateOpportunityImpl(payload);
};

const updateOpportunityImpl = async (payload: UpdateOpportunityInput) => {

  const existingOpportunity = await scopedPrisma(payload.tenantId).opportunity.findFirst({
    where: {
      id: payload.opportunityId
    }
  });

  if (!existingOpportunity) {
    throw new AppError("Opportunity not found.", 404);
  }

  await scopedPrisma(payload.tenantId).opportunity.updateMany({
    where: {
      id: payload.opportunityId
    },
    data: {
      stage: payload.stage as OpportunityStage,
      ...(payload.value !== undefined ? { value: payload.value } : {}),
      ...(payload.aiReasoning ? { aiNextBestAction: payload.aiReasoning } : {})
    }
  });

  const updatedOpportunity = await scopedPrisma(payload.tenantId).opportunity.findFirst({
    where: {
      id: payload.opportunityId
    }
  });

  if (!updatedOpportunity) {
    throw new AppError("Opportunity not found after update.", 500);
  }

  await logAudit({
    tenantId: payload.tenantId,
    userId: payload.userId,
    action: "AI_TOOL_UPDATE_OPPORTUNITY",
    details: {
      opportunityId: payload.opportunityId,
      previousStage: existingOpportunity.stage,
      newStage: payload.stage,
      updatedValue: payload.value !== undefined ? payload.value : existingOpportunity.value
    }
  });

  return updatedOpportunity;
};
