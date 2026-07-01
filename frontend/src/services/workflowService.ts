import { api } from "../lib/api";

export type WorkflowLeadInput = {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  notes?: string;
};

export type WorkflowContact = {
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

export type WorkflowAction =
  | { type: "whatsapp"; message: string; result: unknown }
  | { type: "task"; taskId: string; dueDate: string };

export type WorkflowResult = {
  contact: WorkflowContact;
  score: number;
  reasoning: string;
  actionsTaken: WorkflowAction[];
  workflowStatus?: string;
};

export const workflowService = {
  async qualifyLead(payload: WorkflowLeadInput) {
    const response = await api.post<WorkflowResult>("/workflows/lead-qualification", payload);

    return response.data;
  }
};