import { z } from "zod";

const contactStatusSchema = z.string().trim().min(1).max(80);

export const createContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(40),
  email: z.string().trim().email().optional(),
  company: z.string().trim().min(1).max(160).optional(),
  status: contactStatusSchema,
  lastContactedAt: z.coerce.date().optional()
});

export const updateContactSchema = createContactSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one contact field must be provided."
});

export const queryContactSchema = z.object({
  id: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  company: z.string().trim().min(1).optional(),
  status: contactStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25)
});