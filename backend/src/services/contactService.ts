import { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors";
import { logAudit } from "../lib/auditLogger";
import { scopedPrisma } from "../lib/scopedPrisma";

export type CreateContactInput = {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  status: string;
  lastContactedAt?: Date;
};

export type UpdateContactInput = Partial<CreateContactInput>;

const toAuditContact = (contact: {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  status: string;
  lastContactedAt: Date | null;
  createdAt: Date;
}) => ({
  id: contact.id,
  tenantId: contact.tenantId,
  name: contact.name,
  phone: contact.phone,
  email: contact.email,
  company: contact.company,
  status: contact.status,
  lastContactedAt: contact.lastContactedAt ? contact.lastContactedAt.toISOString() : null,
  createdAt: contact.createdAt.toISOString()
});

export class ContactService {
  async listContacts(tenantId: string, search?: string) {
    return scopedPrisma(tenantId).contact.findMany({
      orderBy: {
        createdAt: "desc"
      },
      ...(search
        ? {
            where: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } }
              ]
            }
          }
        : {})
    });
  }

  async getContactById(tenantId: string, id: string) {
    const contact = await scopedPrisma(tenantId).contact.findFirst({
      where: {
        id
      }
    });

    if (!contact) {
      throw new AppError("Contact not found.", 404);
    }

    return contact;
  }

  async createContact(tenantId: string, userId: string, input: CreateContactInput) {
    try {
      const contact = await scopedPrisma(tenantId).contact.create({
        data: input
      });

      await logAudit({
        tenantId,
        userId,
        action: "contacts.create",
        details: {
          contact: toAuditContact(contact)
        }
      });

      return contact;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Unable to create contact.", 500);
    }
  }

  async updateContact(tenantId: string, userId: string, id: string, input: UpdateContactInput) {
    const existingContact = await scopedPrisma(tenantId).contact.findFirst({
      where: {
        id
      }
    });

    if (!existingContact) {
      throw new AppError("Contact not found.", 404);
    }

    try {
      await scopedPrisma(tenantId).contact.updateMany({
        where: {
          id
        },
        data: input
      });

      const updatedContact = await scopedPrisma(tenantId).contact.findFirst({
        where: {
          id
        }
      });

      if (!updatedContact) {
        throw new AppError("Contact not found.", 404);
      }

      await logAudit({
        tenantId,
        userId,
        action: "contacts.update",
        details: {
          contactId: updatedContact.id,
          before: toAuditContact(existingContact),
          after: toAuditContact(updatedContact)
        }
      });

      return updatedContact;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Unable to update contact.", 500);
    }
  }

  async deleteContact(tenantId: string, userId: string, id: string) {
    const existingContact = await scopedPrisma(tenantId).contact.findFirst({
      where: {
        id
      }
    });

    if (!existingContact) {
      throw new AppError("Contact not found.", 404);
    }

    try {
      await scopedPrisma(tenantId).contact.deleteMany({
        where: {
          id
        }
      });

      await logAudit({
        tenantId,
        userId,
        action: "contacts.delete",
        details: {
          contactId: existingContact.id,
          deleted: toAuditContact(existingContact)
        }
      });

      return existingContact;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Unable to delete contact.", 500);
    }
  }
}