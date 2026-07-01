import type { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors";
import { scopedPrisma } from "../lib/scopedPrisma";
import { InboxMessage, type InboxMessageDocument } from "../models/InboxMessage";

type InboxConversation = {
  contact: Prisma.ContactGetPayload<object>;
  lastMessage: InboxMessageDocument;
};

const demoContacts = [
  {
    name: "Northwind Traders",
    email: "northwind.demo@aihub.local",
    phone: "555-0101",
    company: "Northwind Traders"
  },
  {
    name: "Globex Corporation",
    email: "globex.demo@aihub.local",
    phone: "555-0102",
    company: "Globex Corporation"
  },
  {
    name: "Initech",
    email: "initech.demo@aihub.local",
    phone: "555-0103",
    company: "Initech"
  }
];

const seedTemplates = [
  { channel: "email", direction: "in", offsetDays: 6, contactIndex: 0, content: "Can we review the proposal tomorrow?" },
  { channel: "whatsapp", direction: "out", offsetDays: 5, contactIndex: 0, content: "Sharing the updated quote now." },
  { channel: "call", direction: "in", offsetDays: 4, contactIndex: 1, content: "Please call me after 2 PM." },
  { channel: "email", direction: "out", offsetDays: 3, contactIndex: 1, content: "Following up on the budget discussion." },
  { channel: "whatsapp", direction: "in", offsetDays: 2, contactIndex: 2, content: "Thanks, this looks good to me." },
  { channel: "call", direction: "out", offsetDays: 1, contactIndex: 2, content: "Left a voicemail with next steps." },
  { channel: "email", direction: "in", offsetDays: 0, contactIndex: 0, content: "Can you send the contract version?" },
  { channel: "whatsapp", direction: "out", offsetDays: 0, contactIndex: 1, content: "Absolutely, I’ll send it over." }
] as const;

const toPlainMessage = (message: InboxMessageDocument) => ({
  tenantId: message.tenantId,
  contactId: message.contactId,
  channel: message.channel,
  direction: message.direction,
  content: message.content,
  sentiment: message.sentiment ?? null,
  intent: message.intent ?? null,
  summary: message.summary ?? null,
  createdAt: message.createdAt
});

const sortByLatestMessage = (left: InboxConversation, right: InboxConversation) =>
  right.lastMessage.createdAt.getTime() - left.lastMessage.createdAt.getTime();

export class InboxService {
  async listConversations(tenantId: string) {
    const messages = await InboxMessage.find({ tenantId }).sort({ createdAt: -1 }).exec();
    const lastMessageByContact = new Map<string, InboxMessageDocument>();

    for (const message of messages) {
      if (!lastMessageByContact.has(message.contactId)) {
        lastMessageByContact.set(message.contactId, message);
      }
    }

    const contactIds = Array.from(lastMessageByContact.keys());

    if (contactIds.length === 0) {
      return [] as InboxConversation[];
    }

    const contacts = await scopedPrisma(tenantId).contact.findMany({
      where: {
        id: {
          in: contactIds
        }
      }
    });

    const contactById = new Map(contacts.map((contact) => [contact.id, contact]));

    return Array.from(lastMessageByContact.entries())
      .map(([contactId, lastMessage]) => ({
        contact: contactById.get(contactId),
        lastMessage
      }))
      .filter((conversation): conversation is InboxConversation => Boolean(conversation.contact))
      .sort(sortByLatestMessage);
  }

  async getConversationByContactId(tenantId: string, contactId: string) {
    const contact = await scopedPrisma(tenantId).contact.findFirst({
      where: {
        id: contactId
      }
    });

    if (!contact) {
      throw new AppError("Contact not found.", 404);
    }

    const messages = await InboxMessage.find({ tenantId, contactId }).sort({ createdAt: 1 }).exec();

    return {
      contact,
      messages: messages.map(toPlainMessage)
    };
  }

  async seedDemoData(tenantId: string) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError("Demo data seeding is disabled in production.", 403);
    }

    const contactQuery = await scopedPrisma(tenantId).contact.findMany({
      where: {
        email: {
          in: demoContacts.map((contact) => contact.email)
        }
      }
    });

    const existingContacts = new Map(contactQuery.map((contact) => [contact.email ?? "", contact]));
    const seededContacts = [] as Array<{
      id: string;
      tenantId: string;
      name: string;
      phone: string;
      email: string | null;
      company: string | null;
      status: string;
      lastContactedAt: Date | null;
      createdAt: Date;
    }>;

    for (const demoContact of demoContacts) {
      const existingContact = existingContacts.get(demoContact.email);

      if (existingContact) {
        seededContacts.push(existingContact);
        continue;
      }

      const createdContact = await scopedPrisma(tenantId).contact.create({
        data: {
          name: demoContact.name,
          phone: demoContact.phone,
          email: demoContact.email,
          company: demoContact.company,
          status: "DEMO",
          lastContactedAt: null
        }
      });

      seededContacts.push(createdContact);
    }

    const now = Date.now();

    for (const template of seedTemplates) {
      const contact = seededContacts[template.contactIndex];

      await InboxMessage.create({
        tenantId,
        contactId: contact.id,
        channel: template.channel,
        direction: template.direction,
        content: template.content,
        createdAt: new Date(now - template.offsetDays * 24 * 60 * 60 * 1000)
      });
    }

    return {
      contacts: seededContacts.length,
      messages: seedTemplates.length
    };
  }
}