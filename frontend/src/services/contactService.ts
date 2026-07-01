import { api } from "../lib/api";

export type ContactRecord = {
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

export type ContactListResponse = {
  contacts: ContactRecord[];
};

export type ContactInput = {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  status: string;
  lastContactedAt?: string;
};

export const contactService = {
  async listContacts(search?: string) {
    const response = await api.get<ContactListResponse>("/contacts", {
      params: search ? { search } : undefined
    });

    return response.data.contacts;
  },

  async getContactById(id: string) {
    const response = await api.get<{ contact: ContactRecord }>(`/contacts/${id}`);

    return response.data.contact;
  },

  async createContact(payload: ContactInput) {
    const response = await api.post<{ contact: ContactRecord }>("/contacts", payload);

    return response.data.contact;
  },

  async updateContact(id: string, payload: Partial<ContactInput>) {
    const response = await api.put<{ contact: ContactRecord }>(`/contacts/${id}`, payload);

    return response.data.contact;
  },

  async deleteContact(id: string) {
    await api.delete(`/contacts/${id}`);
  }
};