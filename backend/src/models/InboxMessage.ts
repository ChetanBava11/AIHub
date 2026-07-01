import { Schema, model, models } from "mongoose";

export type InboxChannel = "whatsapp" | "email" | "call";
export type InboxDirection = "in" | "out";

export interface InboxMessageDocument {
  tenantId: string;
  contactId: string;
  channel: InboxChannel;
  direction: InboxDirection;
  content: string;
  sentiment?: string | null;
  intent?: string | null;
  summary?: string | null;
  createdAt: Date;
}

const inboxMessageSchema = new Schema<InboxMessageDocument>(
  {
    tenantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    contactId: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      required: true,
      enum: ["whatsapp", "email", "call"],
    },
    direction: {
      type: String,
      required: true,
      enum: ["in", "out"],
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    sentiment: {
      type: String,
      default: null,
      trim: true,
    },
    intent: {
      type: String,
      default: null,
      trim: true,
    },
    summary: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const InboxMessage =
  models.InboxMessage || model<InboxMessageDocument>("InboxMessage", inboxMessageSchema);
