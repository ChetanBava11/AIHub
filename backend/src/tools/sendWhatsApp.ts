import { z } from "zod";
import { logAudit } from "../lib/auditLogger";
import { sendWhatsAppMessage } from "../services/whatsapp";
import { InboxMessage } from "../models/InboxMessage";
import type { SendWhatsAppInput } from "./types";

const sendWhatsAppSchema = z.object({
  tenantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  contactId: z.string().trim().min(1),
  message: z.string().trim().min(1)
});

export const sendWhatsApp = async (
  arg1: SendWhatsAppInput | string,
  userId?: string,
  contactId?: string,
  message?: string
) => {
  const payload =
    typeof arg1 === "string"
      ? sendWhatsAppSchema.parse({
          tenantId: arg1,
          userId: userId ?? "",
          contactId: contactId ?? "",
          message: message ?? ""
        })
      : sendWhatsAppSchema.parse(arg1);

  return sendWhatsAppImpl(payload);
};

const sendWhatsAppImpl = async (payload: SendWhatsAppInput) => {

  const result = await sendWhatsAppMessage(
    payload.tenantId,
    payload.userId,
    payload.contactId,
    payload.message
  );

  await InboxMessage.create({
    tenantId: payload.tenantId,
    contactId: payload.contactId,
    channel: "whatsapp",
    direction: "out",
    content: payload.message
  });

  await logAudit({
    tenantId: payload.tenantId,
    userId: payload.userId,
    action: "AI_TOOL_SEND_WHATSAPP",
    details: {
      contactId: payload.contactId,
      messageLength: payload.message.length,
      mockMode: true
    }
  });

  return result;
};
