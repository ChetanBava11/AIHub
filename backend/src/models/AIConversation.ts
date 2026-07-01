import { type Document, model, models, Schema } from "mongoose";

export interface AIConversationDocument extends Document {
  tenantId: string;
  userId: string;
  title: string;
  createdAt: Date;
}

const aiConversationSchema = new Schema<AIConversationDocument>(
  {
    tenantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const AIConversation =
  models.AIConversation || model<AIConversationDocument>("AIConversation", aiConversationSchema);
