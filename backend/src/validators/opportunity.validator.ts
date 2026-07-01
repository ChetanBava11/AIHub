import { z } from "zod";

const opportunityStageSchema = z.enum(["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"]);

export const createOpportunitySchema = z.object({
  contactId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160),
  value: z.coerce.number().positive(),
  stage: opportunityStageSchema.default("NEW"),
  aiNextBestAction: z.string().trim().min(1).max(2000).optional()
});

export const updateOpportunitySchema = createOpportunitySchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one opportunity field must be provided."
});

export const queryOpportunitySchema = z.object({
  id: z.string().trim().min(1).optional(),
  contactId: z.string().trim().min(1).optional(),
  stage: opportunityStageSchema.optional(),
  minValue: z.coerce.number().nonnegative().optional(),
  maxValue: z.coerce.number().nonnegative().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25)
});