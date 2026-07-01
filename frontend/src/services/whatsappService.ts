import { api } from "../lib/api";

export type WhatsAppSendInput = {
  contactId: string;
  message: string;
};

export type WhatsAppSendResponse = {
  success: boolean;
  mock?: boolean;
  timestamp?: string;
};

export const whatsappService = {
  async sendWhatsApp(payload: WhatsAppSendInput) {
    // TODO: Backend support for POST /whatsapp/send is still required until the route is added.
    const response = await api.post<WhatsAppSendResponse>("/whatsapp/send", payload);

    return response.data;
  }
};