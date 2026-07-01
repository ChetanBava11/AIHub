import type { Request, Response } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import type { DashboardService } from "../services/dashboardService";

export const createDashboardController = (dashboardService: DashboardService) => ({
  getKpis: asyncHandler(async (req: Request, res: Response) => {
    const kpis = await dashboardService.getKpis(req.auth!.tenantId);

    res.json(kpis);
  })
});