import { AppError } from "../lib/errors";
import { scopedPrisma } from "../lib/scopedPrisma";

export const sendWhatsAppMessage = async (
  tenantId: string,
  userId: string,
  contactId: string,
  message: string
) => {
  const contact = await scopedPrisma(tenantId).contact.findFirst({
    where: {
      id: contactId
    }
  });

  if (!contact) {
    throw new AppError("Contact not found or not accessible.", 403);
  }

  const phone = contact.phone ?? "unknown number";
  // NOTE: This is a mock mode placeholder. Replace this function with a real Meta Cloud API implementation later.
  // The service intentionally isolates real API integration to this file.
  // eslint-disable-next-line no-console
  console.log(`[MOCK MODE] Would send WhatsApp to ${phone}: ${message}`);

  return {
    success: true,
    mock: true,
    timestamp: new Date()
  };
};
