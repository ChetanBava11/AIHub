import { z } from "zod";
import type { SearchContactsInput, SearchContactResult } from "./types";
import { logAudit } from "../lib/auditLogger";
import { scopedPrisma } from "../lib/scopedPrisma";

const searchContactsSchema = z.object({
  tenantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  query: z.string().trim().min(1)
});

export async function searchContacts(input: SearchContactsInput): Promise<SearchContactResult[]>;
export async function searchContacts(
  tenantId: string,
  userId: string,
  query: string
): Promise<SearchContactResult[]>;
export async function searchContacts(
  arg1: string | SearchContactsInput,
  userId?: string,
  query?: string
): Promise<SearchContactResult[]> {
  const payload =
    typeof arg1 === "string"
      ? { tenantId: arg1, userId: userId ?? "", query: query ?? "" }
      : arg1;

  const validated = searchContactsSchema.parse(payload);

  const contacts = await scopedPrisma(validated.tenantId).contact.findMany({
    where: {
      OR: [
        { name: { contains: validated.query, mode: "insensitive" } },
        { phone: { contains: validated.query, mode: "insensitive" } },
        { email: { contains: validated.query, mode: "insensitive" } },
        { company: { contains: validated.query, mode: "insensitive" } }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      company: true,
      status: true,
      createdAt: true
    }
  });

  await logAudit({
    tenantId: validated.tenantId,
    userId: validated.userId,
    action: "AI_TOOL_SEARCH_CONTACTS",
    details: {
      query: validated.query,
      resultCount: contacts.length
    }
  });

  return contacts;
}
