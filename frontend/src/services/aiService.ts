import { api } from "../lib/api";

export type AIConversationRecord = {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  createdAt: string;
};

export type AIMessageRole = "user" | "assistant" | "tool";

export type AIMessageRecord = {
  id: string;
  conversationId: string;
  role: AIMessageRole;
  content: string;
  toolCalls?: Array<unknown>;
  explanation?: string | null;
  createdAt: string;
};

export type AIConversationListResponse = {
  conversations: AIConversationRecord[];
};

export type AIConversationDetailResponse = {
  conversation: AIConversationRecord;
  messages: AIMessageRecord[];
};

export type AIChatRequest = {
  conversationId?: string;
  message: string;
};

export type AIChatStreamEvent =
  | { type: "streaming_started"; conversationId: string; tenantId: string }
  | { type: "assistant_chunk"; chunk: string }
  | { type: "tool_call"; tool: string; status: string }
  | { type: "tool_result"; tool: string; success: boolean; result: unknown; error?: string }
  | { type: "assistant_final"; text: string }
  | { type: "streaming_completed"; conversationId: string; toolCalls: number }
  | { type: "error"; message: string }
  | { type: "done" };

export type AIChatStreamHandlers = {
  onEvent?: (event: AIChatStreamEvent) => void;
  onConversationStarted?: (conversationId: string) => void;
  onAssistantChunk?: (chunk: string) => void;
  onToolCall?: (tool: string, status: string) => void;
  onToolResult?: (payload: Extract<AIChatStreamEvent, { type: "tool_result" }>) => void;
  onAssistantFinal?: (text: string) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
};

const parseEventPayload = (eventName: string, rawData: string): AIChatStreamEvent | null => {
  if (eventName === "done" || rawData.trim() === "[DONE]") {
    return { type: "done" };
  }

  let parsedData: unknown;

  try {
    parsedData = JSON.parse(rawData);
  } catch {
    return null;
  }

  if (!parsedData || typeof parsedData !== "object") {
    return null;
  }

  switch (eventName) {
    case "streaming_started": {
      const payload = parsedData as { conversationId?: unknown; tenantId?: unknown };
      if (typeof payload.conversationId === "string" && typeof payload.tenantId === "string") {
        return { type: "streaming_started", conversationId: payload.conversationId, tenantId: payload.tenantId };
      }
      return null;
    }
    case "assistant_chunk":
      if (typeof (parsedData as { chunk?: unknown }).chunk === "string") {
        return { type: "assistant_chunk", chunk: (parsedData as { chunk: string }).chunk };
      }
      return null;
    case "tool_call": {
      const payload = parsedData as { tool?: unknown; status?: unknown };
      if (typeof payload.tool === "string" && typeof payload.status === "string") {
        return { type: "tool_call", tool: payload.tool, status: payload.status };
      }
      return null;
    }
    case "tool_result": {
      const payload = parsedData as { tool?: unknown; success?: unknown; result?: unknown; error?: unknown };
      if (typeof payload.tool === "string" && typeof payload.success === "boolean") {
        return {
          type: "tool_result",
          tool: payload.tool,
          success: payload.success,
          result: payload.result,
          error: typeof payload.error === "string" ? payload.error : undefined
        };
      }
      return null;
    }
    case "assistant_final":
      if (typeof (parsedData as { text?: unknown }).text === "string") {
        return { type: "assistant_final", text: (parsedData as { text: string }).text };
      }
      return null;
    case "streaming_completed": {
      const payload = parsedData as { conversationId?: unknown; toolCalls?: unknown };
      if (typeof payload.conversationId === "string" && typeof payload.toolCalls === "number") {
        return { type: "streaming_completed", conversationId: payload.conversationId, toolCalls: payload.toolCalls };
      }
      return null;
    }
    case "error":
      if (typeof (parsedData as { message?: unknown }).message === "string") {
        return { type: "error", message: (parsedData as { message: string }).message };
      }
      return null;
    default:
      return null;
  }
};

const emitEvent = (handlers: AIChatStreamHandlers, event: AIChatStreamEvent) => {
  handlers.onEvent?.(event);

  switch (event.type) {
    case "streaming_started":
      handlers.onConversationStarted?.(event.conversationId);
      break;
    case "assistant_chunk":
      handlers.onAssistantChunk?.(event.chunk);
      break;
    case "tool_call":
      handlers.onToolCall?.(event.tool, event.status);
      break;
    case "tool_result":
      handlers.onToolResult?.(event);
      break;
    case "assistant_final":
      handlers.onAssistantFinal?.(event.text);
      break;
    case "error":
      handlers.onError?.(event.message);
      break;
    case "done":
      handlers.onDone?.();
      break;
  }
};

const readSseStream = async (
  response: Response,
  handlers: AIChatStreamHandlers
): Promise<{ conversationId?: string; assistantText: string }> => {
  if (!response.body) {
    throw new Error("AI chat response stream is missing.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEventName = "message";
  let currentData = "";
  let conversationId: string | undefined;
  let assistantText = "";

  const flushEvent = () => {
    if (!currentData) {
      currentEventName = "message";
      return;
    }

    const parsedEvent = parseEventPayload(currentEventName, currentData.trim());
    if (parsedEvent) {
      if (parsedEvent.type === "streaming_started") {
        conversationId = parsedEvent.conversationId;
      }

      if (parsedEvent.type === "assistant_chunk") {
        assistantText += parsedEvent.chunk;
      }

      if (parsedEvent.type === "assistant_final") {
        assistantText = parsedEvent.text;
      }

      emitEvent(handlers, parsedEvent);
    }

    currentEventName = "message";
    currentData = "";
  };

  const processLine = (line: string) => {
    if (!line) {
      flushEvent();
      return;
    }

    if (line.startsWith("event:")) {
      currentEventName = line.slice(6).trim();
      return;
    }

    if (line.startsWith("data:")) {
      currentData += `${line.slice(5).trimStart()}\n`;
    }
  };

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      processLine(line);
      newlineIndex = buffer.indexOf("\n");
    }
  }

  buffer += decoder.decode();
  if (buffer.length > 0) {
    processLine(buffer.replace(/\r$/, ""));
  }

  if (currentData) {
    flushEvent();
  }

  return { conversationId, assistantText };
};

export type AIChatRequest = {
  conversationId?: string;
  message: string;
};

export const aiService = {
  async listConversations() {
    const response = await api.get<AIConversationListResponse>("/ai/conversations");

    return response.data.conversations;
  },

  async getConversation(id: string) {
    const response = await api.get<AIConversationDetailResponse>(`/ai/conversations/${id}`);

    return response.data;
  },

  async streamChat(request: AIChatRequest, handlers: AIChatStreamHandlers = {}) {
    const response = await fetch(api.getUri({ url: "/ai/chat" }), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `AI chat request failed with status ${response.status}.`);
    }

    return readSseStream(response, handlers);
  }
};