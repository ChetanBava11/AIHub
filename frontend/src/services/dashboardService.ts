import { api } from "../lib/api";

export type DashboardKpis = {
  activeOpportunitiesCount: number;
  revenuePipelineSum: number;
  pendingFollowupsCount: number;
  customerActivityCount: number;
  aiAlertsCount: number;
};

export const dashboardService = {
  async getKpis() {
    const response = await api.get<DashboardKpis>("/dashboard/kpis");

    return response.data;
  }
};