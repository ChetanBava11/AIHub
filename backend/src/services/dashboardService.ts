import { Prisma } from "@prisma/client";
import { scopedPrisma } from "../lib/scopedPrisma";

const revenueFromOpportunities = (opportunities: Array<{ value: Prisma.Decimal }>) =>
  opportunities.reduce((sum, opportunity) => sum + Number(opportunity.value), 0);

export class DashboardService {
  async getKpis(tenantId: string) {
    const [opportunities, pendingTasks, contacts] = await Promise.all([
      scopedPrisma(tenantId).opportunity.findMany({
        where: {
          stage: {
            notIn: ["WON", "LOST"]
          }
        }
      }),
      scopedPrisma(tenantId).task.findMany({
        where: {
          completed: false
        }
      }),
      scopedPrisma(tenantId).contact.count()
    ]);

    return {
      activeOpportunitiesCount: opportunities.length,
      revenuePipelineSum: revenueFromOpportunities(opportunities),
      pendingFollowupsCount: pendingTasks.length,
      customerActivityCount: contacts,
      aiAlertsCount: 0
      // TODO: Phase 3 will compute AI alerts from inbox intelligence and scoring.
    };
  }
}