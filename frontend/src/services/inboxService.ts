import { api } from "../lib/api";
import type { ContactRecord } from "./contactService";

export type InboxMessageRecord = {
  tenantId: string;
  contactId: string;
  channel: "whatsapp" | "email" | "call";
  direction: "in" | "out";
  content: string;
  sentiment: string | null;
  intent: string | null;
  summary: string | null;
  createdAt: string;
};

export type InboxConversation = {
  contact: ContactRecord;
  lastMessage: InboxMessageRecord;
};

export type InboxThread = {
  contact: ContactRecord;
  messages: InboxMessageRecord[];
  aiSummary?: string | null;
  sentiment?: string | null;
  intent?: string | null;
  lastAnalyzedAt?: string | null;
};

export type InboxSeedResponse = {
  contacts: number;
  messages: number;
};

export const inboxService = {
  async listConversations() {
    const response = await api.get<InboxConversation[]>("/inbox");

    return response.data;
  },

  async getConversation(contactId: string) {
    const response = await api.get<InboxThread>(`/inbox/${contactId}`);

    return response.data;
  },

  async seedDemoData() {
    const response = await api.post<InboxSeedResponse>("/inbox/seed-demo-data");

    return response.data;
  }
};