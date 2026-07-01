import { z } from "zod";
import { DashboardService } from "../services/dashboardService";
import { logAudit } from "../lib/auditLogger";
import type { FetchBusinessMetricsInput } from "./types";

const fetchBusinessMetricsSchema = z.object({
  tenantId: z.string().trim().min(1),
  userId: z.string().trim().min(1)
});

export const fetchBusinessMetrics = async (
  arg1: FetchBusinessMetricsInput | string,
  userId?: string
) => {
  const payload =
    typeof arg1 === "string"
      ? fetchBusinessMetricsSchema.parse({ tenantId: arg1, userId: userId ?? "" })
      : fetchBusinessMetricsSchema.parse(arg1);

  return fetchBusinessMetricsImpl(payload);
};

const fetchBusinessMetricsImpl = async (payload: FetchBusinessMetricsInput) => {
  const dashboardService = new DashboardService();
  const metrics = await dashboardService.getKpis(payload.tenantId);

  await logAudit({
    tenantId: payload.tenantId,
    userId: payload.userId,
    action: "AI_TOOL_FETCH_BUSINESS_METRICS",
    details: {
      requestedBy: payload.userId
    }
  });

  return metrics;
};
