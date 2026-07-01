import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AIConversation, type AIConversationDocument } from "../models/AIConversation";
import { AIMessage, type AIMessageDocument, type AIMessageRole } from "../models/AIMessage";
import {
  createGeminiClient,
  type GeminiChatMessage,
  type GeminiClient,
  streamGenerateContentEvents,
  geminiToolDefinitions
} from "../lib/gemini";
import { AppError } from "../lib/errors";
import { logAudit } from "../lib/auditLogger";
import { createTask } from "../tools/createTask";
import { searchContacts } from "../tools/searchContacts";
import { fetchBusinessMetrics } from "../tools/fetchBusinessMetrics";
import { sendWhatsApp } from "../tools/sendWhatsApp";
import { updateOpportunity } from "../tools/updateOpportunity";

export type AIConversationRecord = {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  createdAt: Date;
};

export type AIMessageRecord = {
  id: string;
  conversationId: string;
  role: AIMessageRole;
  content: string;
  toolCalls?: Array<unknown>;
  explanation?: string | null;
  createdAt: Date;
};

type ToolName =
  | "searchContacts"
  | "createTask"
  | "updateOpportunity"
  | "fetchBusinessMetrics"
  | "sendWhatsApp";

type ToolExecutionResult = {
  tool: ToolName;
  args: Record<string, unknown>;
  success: boolean;
  result?: unknown;
  error?: string;
};

type ToolCallRecord = {
  tool: ToolName;
  arguments: Record<string, unknown>;
  success: boolean;
  result?: unknown;
  error?: string;
};

type ToolExecutor = (
  tenantId: string,
  userId: string,
  args: Record<string, unknown>
) => Promise<unknown>;

const createMessageSchema = z.object({
  conversationId: z.string().trim().min(1),
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string().trim().min(1),
  toolCalls: z.array(z.unknown()).optional(),
  explanation: z.string().trim().optional().nullable()
});

const createConversationSchema = z.object({
  tenantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  title: z.string().trim().min(1)
});

const preserveExplanation = (explanation?: string | null) =>
  explanation && explanation.trim()
    ? explanation.trim()
    : "Reason: I used CRM tools because they were required to answer your request accurately.";

const MAX_TOOL_CALLS = 8;

const TOOL_PROGRESS_MESSAGES: Record<ToolName, string> = {
  searchContacts: "Searching contacts...",
  createTask: "Creating task...",
  updateOpportunity: "Updating opportunity...",
  fetchBusinessMetrics: "Fetching dashboard metrics...",
  sendWhatsApp: "Sending WhatsApp..."
};

const isToolName = (value: string): value is ToolName => {
  return Object.prototype.hasOwnProperty.call(TOOL_PROGRESS_MESSAGES, value);
};

const getToolProgressMessage = (toolName: string) => {
  if (isToolName(toolName)) {
    return TOOL_PROGRESS_MESSAGES[toolName];
  }

  return `Executing ${toolName}...`;
};

const buildAssistantContent = (content: string, explanation?: string | null) => {
  const trimmed = content.trim();
  const explanationText = preserveExplanation(explanation);
  const contentIncludesExplanation = /Reason:/i.test(trimmed);

  return {
    content: contentIncludesExplanation ? trimmed : `${trimmed} ${explanationText}`.trim(),
    explanation: explanationText
  };
};

export class AIService {
  private readonly geminiClient: GeminiClient;
  private readonly toolRegistry: Record<ToolName, ToolExecutor>;

  constructor() {
    this.geminiClient = createGeminiClient();
    this.toolRegistry = {
      searchContacts: async (tenantId, userId, args) =>
        searchContacts({
          tenantId,
          userId,
          query: String(args.query ?? "")
        }),
      createTask: async (tenantId, userId, args) =>
        createTask(
          tenantId,
          userId,
          String(args.contactId ?? ""),
          String(args.description ?? ""),
          String(args.dueDate ?? "")
        ),
      updateOpportunity: async (tenantId, userId, args) =>
        updateOpportunity(
          tenantId,
          userId,
          String(args.opportunityId ?? ""),
          String(args.stage ?? "") as any,
          args.value !== undefined ? Number(args.value) : undefined,
          args.aiNextBestAction !== undefined ? String(args.aiNextBestAction) : undefined
        ),
      fetchBusinessMetrics: async (tenantId, userId) => fetchBusinessMetrics(tenantId, userId),
      sendWhatsApp: async (tenantId, userId, args) =>
        sendWhatsApp(
          tenantId,
          userId,
          String(args.contactId ?? ""),
          String(args.message ?? "")
        )
    };
  }

  async createConversation(tenantId: string, userId: string, title: string) {
    const payload = createConversationSchema.parse({ tenantId, userId, title });

    const conversation = await AIConversation.create({
      tenantId: payload.tenantId,
      userId: payload.userId,
      title: payload.title
    });

    return this.toConversationRecord(conversation);
  }

  async saveUserMessage(conversationId: string, content: string) {
    const payload = createMessageSchema.parse({
      conversationId,
      role: "user",
      content
    });

    const message = await AIMessage.create({
      conversationId: payload.conversationId,
      role: payload.role,
      content: payload.content
    });

    return this.toMessageRecord(message);
  }

  async saveAssistantMessage(
    conversationId: string,
    content: string,
    explanation?: string | null,
    toolCalls?: Array<unknown>
  ) {
    const assistantData = buildAssistantContent(content, explanation);

    const payload = createMessageSchema.parse({
      conversationId,
      role: "assistant",
      content: assistantData.content,
      explanation: assistantData.explanation,
      toolCalls
    });

    const message = await AIMessage.create({
      conversationId: payload.conversationId,
      role: payload.role,
      content: payload.content,
      explanation: payload.explanation,
      toolCalls: payload.toolCalls
    });

    return this.toMessageRecord(message);
  }

  async saveToolMessage(conversationId: string, toolName: string, content: string, toolData: unknown) {
    const payload = createMessageSchema.parse({
      conversationId,
      role: "tool",
      content,
      toolCalls: [{ tool: toolName, output: toolData }]
    });

    const message = await AIMessage.create({
      conversationId: payload.conversationId,
      role: payload.role,
      content: payload.content,
      toolCalls: payload.toolCalls
    });

    return this.toMessageRecord(message);
  }

  async fetchConversationById(tenantId: string, conversationId: string) {
    const conversation = await AIConversation.findOne({
      _id: conversationId,
      tenantId
    }).exec();

    if (!conversation) {
      throw new AppError("Conversation not found.", 404);
    }

    return this.toConversationRecord(conversation);
  }

  async listConversationsForUser(tenantId: string, userId: string) {
    const conversations = await AIConversation.find({
      tenantId,
      userId
    })
      .sort({ createdAt: -1 })
      .exec();

    return conversations.map(this.toConversationRecord);
  }

  async listMessagesForConversation(conversationId: string) {
    const messages = await AIMessage.find({ conversationId }).sort({ createdAt: 1 }).exec();
    return messages.map(this.toMessageRecord);
  }

  buildSystemPrompt(tenantName: string, industry: string | null) {
    const currentDate = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(new Date());

    return `You are AIHub Business Assistant.
Tenant Name: ${tenantName}
Industry: ${industry ?? "Unknown"}
Current Date: ${currentDate}
Instructions: Keep answers concise. Always explain reasoning in one sentence. When appropriate, call a backend tool using function definitions. Only use tenant-scoped data. Provide an explanation sentence for every response.`;
  }

  async streamAssistantReply(
    tenantId: string,
    userId: string,
    tenantName: string,
    industry: string | null,
    conversationId: string,
    userMessage: string,
    streamEvent: (event: string, payload: unknown) => void
  ): Promise<{ stream: AsyncGenerator<string, void, void>; toolCalls: Array<unknown> }> {
    if (!userMessage.trim()) {
      throw new AppError("Message cannot be empty.", 400);
    }

    const systemPrompt = this.buildSystemPrompt(tenantName, industry);
    const messages: GeminiChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ];
    const executedToolCalls: Array<unknown> = [];

    await logAudit({
      tenantId,
      userId,
      action: "AI_CONVERSATION_STREAM_STARTED",
      details: {
        conversationId,
        message: userMessage.slice(0, 200)
      }
    });

    streamEvent("streaming_started", { conversationId, tenantId });

    const stream = (async function* (self: AIService) {
      let finalAssistantText = "";
      let toolIterations = 0;
      let completed = false;

      try {
        while (toolIterations < MAX_TOOL_CALLS) {
          toolIterations += 1;

          const responseStream = streamGenerateContentEvents(self.geminiClient, {
            messages,
            functionDefinitions: geminiToolDefinitions
          });

          let responseText = "";
          let requestedToolCall: { name: string; args: Record<string, unknown>; id?: string } | null = null;

          for await (const event of responseStream) {
            if (event.type === "text") {
              responseText += event.text;
              streamEvent("assistant_chunk", { chunk: event.text });
              continue;
            }

            if (!requestedToolCall) {
              requestedToolCall = event.functionCall;
            }
          }

          if (!requestedToolCall) {
            finalAssistantText = responseText.trim();

            if (!finalAssistantText) {
              throw new AppError("Gemini response was empty.", 502);
            }

            completed = true;
            break;
          }

          const toolName = requestedToolCall.name;
          const toolArgs = requestedToolCall.args;

          streamEvent("tool_progress", { tool: toolName, message: getToolProgressMessage(toolName) });
          streamEvent("tool_call", { tool: toolName, status: `Executing ${toolName}...` });

          const toolExecution = await self.executeToolCall(toolName, tenantId, userId, toolArgs);

          const toolCallRecord: ToolCallRecord = toolExecution.success
            ? { tool: toolName as ToolName, arguments: toolArgs, success: true, result: toolExecution.result }
            : { tool: toolName as ToolName, arguments: toolArgs, success: false, error: toolExecution.error };

          executedToolCalls.push(toolCallRecord);
          await self.saveToolMessage(
            conversationId,
            toolName,
            toolExecution.success ? `Executed ${toolName}.` : `Failed to execute ${toolName}.`,
            toolExecution.success ? toolExecution.result : { error: toolExecution.error }
          );

          streamEvent("tool_result", {
            tool: toolName,
            success: toolExecution.success,
            result: toolExecution.result,
            error: toolExecution.error
          });

          messages.push({
            role: "assistant",
            content: JSON.stringify({ function_call: { name: toolName, arguments: toolArgs, id: requestedToolCall.id } })
          });

          messages.push({
            role: "tool",
            name: toolName,
            content: JSON.stringify(toolExecution.success ? toolExecution.result : { error: toolExecution.error })
          });
        }

        if (!completed) {
          throw new AppError("Gemini requested too many tool calls.", 502);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown streaming error.";
        streamEvent("stream_error", { message });
        streamEvent("streaming_completed", {
          conversationId,
          toolCalls: executedToolCalls.length,
          error: message
        });
        throw error;
      }

      streamEvent("assistant_final", { text: finalAssistantText });
      streamEvent("streaming_completed", {
        conversationId,
        toolCalls: executedToolCalls.length
      });
      yield finalAssistantText;
    })(this);

    return { stream, toolCalls: executedToolCalls };
  }

  async ensureConversationBelongsToTenant(tenantId: string, conversationId: string) {
    const conversation = await AIConversation.findOne({
      _id: conversationId,
      tenantId
    }).exec();

    if (!conversation) {
      throw new AppError("Conversation not found.", 404);
    }

    return this.toConversationRecord(conversation);
  }

  private async executeToolCall(
    toolName: string,
    tenantId: string,
    userId: string,
    args: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    if (!Object.prototype.hasOwnProperty.call(this.toolRegistry, toolName)) {
      const message = `Unknown tool requested: ${toolName}`;
      await logAudit({
        tenantId,
        userId,
        action: "AI_TOOL_FAILED",
        details: { tool: toolName, error: message }
      });
      return { tool: toolName as ToolName, args, success: false, error: message };
    }

    await logAudit({
      tenantId,
      userId,
      action: "AI_TOOL_REQUESTED",
      details: {
        tool: toolName,
        args: JSON.parse(JSON.stringify(args))
      } as Prisma.InputJsonValue
    });

    try {
      const result = await this.toolRegistry[toolName as ToolName](tenantId, userId, args);

      await logAudit({
        tenantId,
        userId,
        action: "AI_TOOL_EXECUTED",
        details: { tool: toolName }
      });

      return { tool: toolName as ToolName, args, success: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown tool error.";
      await logAudit({
        tenantId,
        userId,
        action: "AI_TOOL_FAILED",
        details: { tool: toolName, error: message }
      });

      return { tool: toolName as ToolName, args, success: false, error: message };
    }
  }

  private toConversationRecord(conversation: AIConversationDocument): AIConversationRecord {
    return {
      id: conversation._id.toString(),
      tenantId: conversation.tenantId,
      userId: conversation.userId,
      title: conversation.title,
      createdAt: conversation.createdAt
    };
  }

  private toMessageRecord(message: AIMessageDocument): AIMessageRecord {
    return {
      id: message._id.toString(),
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls ?? undefined,
      explanation: message.explanation ?? null,
      createdAt: message.createdAt
    };
  }
}
