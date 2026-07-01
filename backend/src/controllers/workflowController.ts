import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import type { WorkflowService } from "../services/workflowService";

const leadQualificationSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().email().optional(),
  company: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional()
});

export const createWorkflowController = (workflowService: WorkflowService) => ({
  qualifyLead: asyncHandler(async (req: Request, res: Response) => {
    const auth = req.auth;

    if (!auth) {
      throw new Error("Authentication required.");
    }

    const payload = leadQualificationSchema.parse(req.body);

    const result = await workflowService.qualifyLead(auth.tenantId, auth.userId, payload);

    res.status(201).json(result);
  })
});
