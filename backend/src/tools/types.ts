import type { OpportunityStage } from "@prisma/client";

export type SearchContactsInput = {
  tenantId: string;
  userId: string;
  query: string;
};

export type SearchContactResult = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  status: string;
  createdAt: Date;
};

export type CreateTaskInput = {
  tenantId: string;
  userId: string;
  contactId: string;
  description: string;
  dueDate: string;
};

export type UpdateOpportunityInput = {
  tenantId: string;
  userId: string;
  opportunityId: string;
  stage: OpportunityStage;
  value?: number;
  aiReasoning?: string;
};

export type FetchBusinessMetricsInput = {
  tenantId: string;
  userId: string;
};

export type SendWhatsAppInput = {
  tenantId: string;
  userId: string;
  contactId: string;
  message: string;
};
