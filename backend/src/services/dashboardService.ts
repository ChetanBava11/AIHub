import { Prisma } from "@prisma/client";
import { scopedPrisma } from "../lib/scopedPrisma";

const revenueFromOpportunities = (opportunities: Array<{ value: Prisma.Decimal }>) =>
  opportunities.reduce((sum, opportunity) => sum + Number(opportunity.value), 0);

export class DashboardService {
  async getKpis(tenantId: string) {
    const [opportunities, pendingTasks, contacts, aiAlertsCount] = await Promise.all([
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
      scopedPrisma(tenantId).contact.count(),
      scopedPrisma(tenantId).opportunity.count({
        where: {
          stage: "NEW",
          contact: {
            OR: [
              { lastContactedAt: { lt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) } },
              { lastContactedAt: null }
            ]
          }
        }
      })
    ]);

    return {
      activeOpportunitiesCount: opportunities.length,
      revenuePipelineSum: revenueFromOpportunities(opportunities),
      pendingFollowupsCount: pendingTasks.length,
      customerActivityCount: contacts,
      aiAlertsCount
    };
  }
}