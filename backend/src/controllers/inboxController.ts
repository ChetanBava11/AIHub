import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import type { InboxService } from "../services/inboxService";

const contactIdParamSchema = z.object({
  contactId: z.string().trim().min(1)
});

export const createInboxController = (inboxService: InboxService) => ({
  listInbox: asyncHandler(async (req: Request, res: Response) => {
    const conversations = await inboxService.listConversations(req.auth!.tenantId);

    res.json(conversations);
  }),

  getInboxThread: asyncHandler(async (req: Request, res: Response) => {
    const { contactId } = contactIdParamSchema.parse(req.params);
    const thread = await inboxService.getConversationByContactId(req.auth!.tenantId, contactId);

    res.json(thread);
  }),

  seedDemoData: asyncHandler(async (req: Request, res: Response) => {
    const result = await inboxService.seedDemoData(req.auth!.tenantId);

    res.status(201).json(result);
  })
});