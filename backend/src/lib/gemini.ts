import { env } from "../config/env";

export type GeminiChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
};

export type GeminiClient = {
  apiKey?: string;
  model: string;
  endpoint: string;
  demoMode: boolean;
};

const GEMINI_WARNING = `----------------------------------------------------
WARNING:
Gemini API Key not configured.
AI features are running in demo mode.
----------------------------------------------------`;

export const createGeminiClient = (): GeminiClient => {
  const model = env.GEMINI_MODEL || "gemini-1.0";
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn(GEMINI_WARNING);
  }

  return {
    apiKey,
    model,
    endpoint: `https://gemini.googleapis.com/v1/models/${model}:generate`,
    demoMode: !Boolean(apiKey),
  };
};

export type GeminiFunctionDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export const geminiToolDefinitions: GeminiFunctionDefinition[] = [
  {
    name: "searchContacts",
    description: "Search tenant contacts by name, phone, email, or company.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A search term to find matching contacts."
        }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "createTask",
    description: "Create a tenant task linked to a contact with a due date.",
    parameters: {
      type: "object",
      properties: {
        contactId: {
          type: "string",
          description: "The ID of the contact to attach the task to."
        },
        description: {
          type: "string",
          description: "The task description."
        },
        dueDate: {
          type: "string",
          description: "The due date for the task in ISO 8601 format."
        }
      },
      required: ["contactId", "description", "dueDate"],
      additionalProperties: false
    }
  },
  {
    name: "updateOpportunity",
    description: "Update an opportunity stage, value, and AI recommended next action.",
    parameters: {
      type: "object",
      properties: {
        opportunityId: {
          type: "string",
          description: "The ID of the opportunity to update."
        },
        stage: {
          type: "string",
          description: "The new opportunity stage.",
          enum: ["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"]
        },
        value: {
          type: "number",
          description: "The updated revenue value for the opportunity."
        },
        aiNextBestAction: {
          type: "string",
          description: "AI reasoning for the next best action on this opportunity."
        }
      },
      required: ["opportunityId", "stage"],
      additionalProperties: false
    }
  },
  {
    name: "fetchBusinessMetrics",
    description: "Fetch current dashboard KPIs for the tenant.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "sendWhatsApp",
    description: "Send a WhatsApp message through the backend WhatsApp service.",
    parameters: {
      type: "object",
      properties: {
        contactId: {
          type: "string",
          description: "The ID of the contact to message."
        },
        message: {
          type: "string",
          description: "The outgoing WhatsApp message body."
        }
      },
      required: ["contactId", "message"],
      additionalProperties: false
    }
  }
];

export type GeminiStreamOptions = {
  messages: GeminiChatMessage[];
  functionDefinitions?: GeminiFunctionDefinition[];
};

export type GeminiChatOptions = {
  messages: GeminiChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
};

export const chat = async (
  client: GeminiClient,
  options: GeminiChatOptions
): Promise<string> => {
  if (client.demoMode) {
    return "I am a demo Gemini assistant. This is a short AI summary of the conversation.";
  }

  const payload: Record<string, unknown> = {
    messages: options.messages,
    temperature: options.temperature ?? 0.2,
    maxOutputTokens: options.maxOutputTokens ?? 512,
    stream: false
  };

  const response = await fetch(client.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${client.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini request failed with status ${response.status}: ${body}`);
  }

  const body = await response.json();
  return (
    body?.candidates?.[0]?.content?.text ??
    body?.output?.[0]?.content?.text ??
    JSON.stringify(body)
  );
};

const createDemoStream = async function* (messages: GeminiChatMessage[]) {
  const response = `Hello! I am the AIHub Business Assistant. I will keep the answer concise and provide reasoning in one sentence.`;
  const chunkSize = 20;
  for (let i = 0; i < response.length; i += chunkSize) {
    yield response.slice(i, i + chunkSize);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

export const streamChat = async function* (
  client: GeminiClient,
  options: GeminiStreamOptions
): AsyncGenerator<string, void, void> {
  if (client.demoMode) {
    yield* createDemoStream(options.messages);
    return;
  }

  const payload: Record<string, unknown> = {
    messages: options.messages,
    temperature: 0.2,
    maxOutputTokens: 512,
    stream: true,
  };

  if (options.functionDefinitions?.length) {
    payload.functions = options.functionDefinitions;
  }

  const response = await fetch(client.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${client.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini request failed with status ${response.status}: ${body}`);
  }

  if (!response.body) {
    throw new Error("Gemini response body is missing.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (value) {
      yield decoder.decode(value);
    }
  }
};
