import type { Request, Response } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import type { TenantService } from "../services/tenantService";

export const createTenantController = (tenantService: TenantService) => ({
  updateOnboarding: asyncHandler(async (req: Request, res: Response) => {
    const tenant = await tenantService.updateOnboarding(req.auth!.tenantId, req.body);

    res.json({
      tenant
    });
  })
});
