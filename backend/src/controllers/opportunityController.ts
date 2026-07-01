import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../lib/errors";
import {
  createOpportunitySchema,
  queryOpportunitySchema,
  updateOpportunitySchema
} from "../validators/opportunity.validator";
import type { OpportunityService } from "../services/opportunityService";

const idParamSchema = z.object({
  id: z.string().trim().min(1)
});

export const createOpportunityController = (opportunityService: OpportunityService) => ({
  listOpportunities: asyncHandler(async (req: Request, res: Response) => {
    const query = queryOpportunitySchema.parse(req.query);
    const result = await opportunityService.listOpportunities(req.auth!.tenantId, query.stage);

    res.json(result);
  }),

  getOpportunity: asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const result = await opportunityService.getOpportunityById(req.auth!.tenantId, id);

    res.json(result);
  }),

  createOpportunity: asyncHandler(async (req: Request, res: Response) => {
    const payload = createOpportunitySchema.parse(req.body);
    const opportunity = await opportunityService.createOpportunity(
      req.auth!.tenantId,
      req.auth!.userId,
      payload
    );

    res.status(201).json({ opportunity });
  }),

  updateOpportunity: asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const payload = updateOpportunitySchema.parse(req.body);
    const opportunity = await opportunityService.updateOpportunity(
      req.auth!.tenantId,
      req.auth!.userId,
      id,
      payload
    );

    res.json({ opportunity });
  }),

  deleteOpportunity: asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    await opportunityService.deleteOpportunity(req.auth!.tenantId, req.auth!.userId, id);

    res.status(204).send();
  })
});