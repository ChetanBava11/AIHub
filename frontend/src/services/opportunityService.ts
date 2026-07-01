import { api } from "../lib/api";

export type OpportunityStage = "NEW" | "QUALIFIED" | "PROPOSAL" | "WON" | "LOST";

export type OpportunityRecord = {
  id: string;
  tenantId: string;
  contactId: string;
  title: string;
  value: string | number;
  stage: OpportunityStage;
  aiNextBestAction: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OpportunityContact = {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  status: string;
  leadScore: number | null;
  leadScoreReason: string | null;
  lastContactedAt: string | null;
  createdAt: string;
};

export type OpportunityListResponse = {
  data: OpportunityRecord[];
  count: number;
};

export type OpportunityDetailResponse = {
  opportunity: OpportunityRecord & {
    contact: OpportunityContact;
  };
  recentMessages: Array<{
    tenantId: string;
    contactId: string;
    channel: "whatsapp" | "email" | "call";
    direction: "in" | "out";
    content: string;
    sentiment: string | null;
    intent: string | null;
    summary: string | null;
    createdAt: string;
  }>;
};

export type OpportunityInput = {
  contactId: string;
  title: string;
  value: number;
  stage: OpportunityStage;
  aiNextBestAction?: string;
};

export const opportunityService = {
  async listOpportunities(stage?: OpportunityStage) {
    const response = await api.get<OpportunityListResponse>("/opportunities", {
      params: stage ? { stage } : undefined
    });

    return response.data;
  },

  async getOpportunityById(id: string) {
    const response = await api.get<OpportunityDetailResponse>(`/opportunities/${id}`);

    return response.data;
  },

  async createOpportunity(payload: OpportunityInput) {
    const response = await api.post<{ opportunity: OpportunityRecord }>("/opportunities", payload);

    return response.data.opportunity;
  },

  async updateOpportunity(id: string, payload: Partial<OpportunityInput>) {
    const response = await api.put<{ opportunity: OpportunityRecord }>(`/opportunities/${id}`, payload);

    return response.data.opportunity;
  },

  async deleteOpportunity(id: string) {
    await api.delete(`/opportunities/${id}`);
  }
};