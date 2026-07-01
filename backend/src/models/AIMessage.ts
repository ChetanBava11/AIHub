import { type Document, model, models, Schema } from "mongoose";

export type AIMessageRole = "user" | "assistant" | "tool";

export interface AIMessageDocument extends Document {
  conversationId: string;
  role: AIMessageRole;
  content: string;
  toolCalls?: Array<unknown>;
  explanation?: string | null;
  createdAt: Date;
}

const aiMessageSchema = new Schema<AIMessageDocument>(
  {
    conversationId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["user", "assistant", "tool"],
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    toolCalls: {
      type: [Schema.Types.Mixed],
      default: undefined,
    },
    explanation: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

aiMessageSchema.index({ conversationId: 1 });

export const AIMessage =
  models.AIMessage || model<AIMessageDocument>("AIMessage", aiMessageSchema);
