import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../lib/errors";
import {
  createContactSchema,
  queryContactSchema,
  updateContactSchema
} from "../validators/contact.validator";
import type { ContactService } from "../services/contactService";

const idParamSchema = z.object({
  id: z.string().trim().min(1)
});

export const createContactController = (contactService: ContactService) => ({
  listContacts: asyncHandler(async (req: Request, res: Response) => {
    const query = queryContactSchema.parse(req.query);
    const contacts = await contactService.listContacts(req.auth!.tenantId, query.search);

    res.json({ contacts });
  }),

  getContact: asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const contact = await contactService.getContactById(req.auth!.tenantId, id);

    res.json({ contact });
  }),

  createContact: asyncHandler(async (req: Request, res: Response) => {
    const payload = createContactSchema.parse(req.body);
    const contact = await contactService.createContact(req.auth!.tenantId, req.auth!.userId, payload);

    res.status(201).json({ contact });
  }),

  updateContact: asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const payload = updateContactSchema.parse(req.body);
    const contact = await contactService.updateContact(req.auth!.tenantId, req.auth!.userId, id, payload);

    res.json({ contact });
  }),

  deleteContact: asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    await contactService.deleteContact(req.auth!.tenantId, req.auth!.userId, id);

    res.status(204).send();
  })
});