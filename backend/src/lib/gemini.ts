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

export type GeminiFunctionDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type GeminiChatOptions = {
  messages: GeminiChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
};

export type GeminiStreamOptions = {
  messages: GeminiChatMessage[];
  functionDefinitions?: GeminiFunctionDefinition[];
};

type GeminiRole = "user" | "model";

type GeminiContentPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown>; id?: string } }
  | { functionResponse: { name: string; response: Record<string, unknown>; id?: string } };

type GeminiContent = {
  role: GeminiRole;
  parts: GeminiContentPart[];
};

type GeminiFunctionDeclaration = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

type GeminiGenerateContentRequest = {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
  tools?: Array<{ functionDeclarations: GeminiFunctionDeclaration[] }>;
};

type GeminiApiErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type GeminiStreamEvent =
  | { type: "text"; text: string }
  | { type: "functionCall"; functionCall: { name: string; args: Record<string, unknown>; id?: string } };

const GEMINI_WARNING = `----------------------------------------------------
WARNING:
Gemini API Key not configured.
AI features are running in demo mode.
----------------------------------------------------`;

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_OUTPUT_TOKENS = 512;

const TOOL_SCHEMA_KEYS = new Set([
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
  "$id",
  "$defs",
  "$ref",
  "$anchor"
]);

const createDemoText = () =>
  "Hello! I am the AIHub Business Assistant. I will keep the answer concise and provide reasoning in one sentence.";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const sanitizeSchemaValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSchemaValue(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (key === "properties" && isRecord(entry)) {
      sanitized.properties = Object.fromEntries(
        Object.entries(entry).map(([propertyName, propertySchema]) => [
          propertyName,
          sanitizeSchemaValue(propertySchema)
        ])
      );
      continue;
    }

    if (key === "$defs" && isRecord(entry)) {
      sanitized.$defs = Object.fromEntries(
        Object.entries(entry).map(([definitionName, definitionSchema]) => [
          definitionName,
          sanitizeSchemaValue(definitionSchema)
        ])
      );
      continue;
    }

    if (key === "items" || key === "prefixItems" || key === "anyOf" || key === "oneOf") {
      sanitized[key] = sanitizeSchemaValue(entry);
      continue;
    }

    if (TOOL_SCHEMA_KEYS.has(key)) {
      sanitized[key] = sanitizeSchemaValue(entry);
    }
  }

  return sanitized;
};

const normalizeModel = (model: string) => {
  const trimmed = model.trim();
  return trimmed || DEFAULT_MODEL;
};

const getApiKeyQuery = (apiKey: string) => `?key=${encodeURIComponent(apiKey)}`;

const buildEndpoint = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`;

const parseJsonObject = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const parseMessagePayload = (content: string): Record<string, unknown> | null => {
  const parsed = parseJsonObject(content);
  if (parsed) {
    return parsed;
  }

  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseJsonObject(trimmed);
  }

  return null;
};

const normalizeFunctionArguments = (args: unknown): Record<string, unknown> => {
  if (isRecord(args)) {
    return args;
  }

  if (typeof args === "string") {
    const parsed = parseJsonObject(args);
    if (parsed) {
      return parsed;
    }
  }

  return {};
};

const normalizeToolResponse = (content: string): Record<string, unknown> => {
  const parsed = parseMessagePayload(content);
  if (parsed) {
    return parsed;
  }

  return { text: content };
};

const toContentPart = (message: GeminiChatMessage): GeminiContentPart | null => {
  if (message.role === "user") {
    return { text: message.content };
  }

  if (message.role === "assistant") {
    const payload = parseMessagePayload(message.content);
    const functionCall = payload?.function_call;

    if (isRecord(functionCall) && typeof functionCall.name === "string" && functionCall.name.trim()) {
      return {
        functionCall: {
          name: functionCall.name.trim(),
          args: normalizeFunctionArguments(functionCall.arguments),
          id: typeof functionCall.id === "string" && functionCall.id.trim() ? functionCall.id.trim() : undefined
        }
      };
    }

    return { text: message.content };
  }

  if (message.role === "tool") {
    return {
      functionResponse: {
        name: message.name?.trim() || "tool",
        response: normalizeToolResponse(message.content)
      }
    };
  }

  return null;
};

const toGenerateContentRequest = (
  options: GeminiChatOptions & { functionDefinitions?: GeminiFunctionDefinition[] }
): GeminiGenerateContentRequest => {
  const systemMessages = options.messages.filter((message) => message.role === "system");
  const nonSystemMessages = options.messages.filter((message) => message.role !== "system");

  const contents = nonSystemMessages
    .map((message) => {
      const part = toContentPart(message);

      if (!part) {
        return null;
      }

      return {
        role: message.role === "assistant" ? "model" : "user",
        parts: [part]
      } satisfies GeminiContent;
    })
    .filter((content): content is GeminiContent => Boolean(content));

  const request: GeminiGenerateContentRequest = {
    contents: contents.length > 0 ? contents : [{ role: "user", parts: [{ text: "" }] }],
    generationConfig: {
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
    }
  };

  if (systemMessages.length > 0) {
    request.systemInstruction = {
      parts: [
        {
          text: systemMessages.map((message) => message.content).join("\n")
        }
      ]
    };
  }

  if (options.functionDefinitions?.length) {
    request.tools = [
      {
        functionDeclarations: options.functionDefinitions.map((definition) => ({
          name: definition.name.trim(),
          description: definition.description.trim(),
          parameters: sanitizeSchemaValue(definition.parameters) as Record<string, unknown>
        }))
      }
    ];
  }

  return request;
};

const createGeminiError = (response: Response, bodyText: string) => {
  const fallback = `Gemini request failed with status ${response.status}.`;
  let message = fallback;

  try {
    const parsed = JSON.parse(bodyText) as GeminiApiErrorPayload;
    const apiMessage = parsed.error?.message?.trim();
    const apiStatus = parsed.error?.status?.trim();

    if (apiMessage) {
      message = apiStatus ? `${apiStatus}: ${apiMessage}` : apiMessage;
    }
  } catch {
    if (bodyText.trim()) {
      message = bodyText.trim();
    }
  }

  const normalizedMessage = message.toLowerCase();

  if (response.status === 401) {
    return new Error(`Invalid Gemini API key. ${message}`);
  }

  if (response.status === 403) {
    if (normalizedMessage.includes("quota") || normalizedMessage.includes("rate limit")) {
      return new Error(`Gemini quota exceeded. ${message}`);
    }

    return new Error(`Gemini access forbidden. ${message}`);
  }

  if (response.status === 404) {
    return new Error(`Gemini model or endpoint not found. ${message}`);
  }

  if (response.status === 429) {
    return new Error(`Gemini rate limit exceeded. ${message}`);
  }

  if (response.status >= 500) {
    return new Error(`Gemini service error. ${message}`);
  }

  return new Error(message);
};

const extractTextFromResponse = (body: unknown): string => {
  if (!isRecord(body)) {
    throw new Error("Gemini response was malformed.");
  }

  const candidates = body.candidates;
  if (Array.isArray(candidates) && candidates.length > 0) {
    const candidate = candidates[0];
    if (isRecord(candidate)) {
      const content = candidate.content;
      if (isRecord(content) && Array.isArray(content.parts)) {
        const text = content.parts
          .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
          .join("")
          .trim();

        if (text) {
          return text;
        }
      }
    }
  }

  const text = body.text;
  if (typeof text === "string" && text.trim()) {
    return text.trim();
  }

  throw new Error("Gemini response did not contain assistant text.");
};

const extractStreamEvents = (body: unknown): GeminiStreamEvent[] => {
  if (!isRecord(body)) {
    return [];
  }

  const candidate = Array.isArray(body.candidates) ? body.candidates[0] : undefined;
  if (!isRecord(candidate)) {
    return [];
  }

  const content = candidate.content;
  if (!isRecord(content) || !Array.isArray(content.parts)) {
    return [];
  }

  const events: GeminiStreamEvent[] = [];

  for (const part of content.parts) {
    if (isRecord(part) && typeof part.text === "string" && part.text) {
      events.push({ type: "text", text: part.text });
    }

    if (isRecord(part) && isRecord(part.functionCall) && typeof part.functionCall.name === "string") {
      events.push({
        type: "functionCall",
        functionCall: {
          name: part.functionCall.name,
          args: normalizeFunctionArguments(part.functionCall.args),
          id: typeof part.functionCall.id === "string" ? part.functionCall.id : undefined
        }
      });
    }
  }

  return events;
};

const readSsePayloads = async function* (response: Response): AsyncGenerator<unknown, void, void> {
  if (!response.body) {
    throw new Error("Gemini response body is missing.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let mode: "unknown" | "array" | "single" | "done" = "unknown";
  let collecting = false;
  let current = "";
  let depth = 0;
  let inString = false;
  let escape = false;

  const finishValue = async function* (value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    try {
      yield JSON.parse(trimmed) as unknown;
    } catch {
      // Ignore malformed chunks and keep consuming the stream.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    const chunk = decoder.decode(value, { stream: true });

    for (const character of chunk) {
      if (mode === "done") {
        continue;
      }

      if (mode === "unknown") {
        if (/\s/.test(character)) {
          continue;
        }

        if (character === "[") {
          mode = "array";
          continue;
        }

        if (character === "{") {
          mode = "single";
          collecting = true;
          current = "{";
          depth = 1;
          inString = false;
          escape = false;
          continue;
        }

        continue;
      }

      if (mode === "array" && !collecting) {
        if (/\s/.test(character) || character === ",") {
          continue;
        }

        if (character === "]") {
          mode = "done";
          continue;
        }

        if (character === "{") {
          collecting = true;
          current = "{";
          depth = 1;
          inString = false;
          escape = false;
        }

        continue;
      }

      if (!collecting) {
        continue;
      }

      current += character;

      if (escape) {
        escape = false;
        continue;
      }

      if (character === "\\" && inString) {
        escape = true;
        continue;
      }

      if (character === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (character === "{" || character === "[") {
        depth += 1;
        continue;
      }

      if (character === "}" || character === "]") {
        depth -= 1;

        if (depth === 0) {
          for await (const payload of finishValue(current)) {
            yield payload;
          }

          current = "";
          collecting = false;

          if (mode === "single") {
            mode = "done";
          }
        }
      }
    }
  }

  const trailingChunk = decoder.decode().trim();
  if (trailingChunk && mode !== "done") {
    for (const character of trailingChunk) {
      if (mode === "done") {
        break;
      }

      if (!collecting) {
        if (/\s/.test(character) || character === "," || character === "[") {
          continue;
        }

        if (character === "{") {
          collecting = true;
          current = "{";
          depth = 1;
          inString = false;
          escape = false;
        }

        continue;
      }

      current += character;

      if (escape) {
        escape = false;
        continue;
      }

      if (character === "\\" && inString) {
        escape = true;
        continue;
      }

      if (character === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (character === "{" || character === "[") {
        depth += 1;
        continue;
      }

      if (character === "}" || character === "]") {
        depth -= 1;

        if (depth === 0) {
          for await (const payload of finishValue(current)) {
            yield payload;
          }

          current = "";
          collecting = false;
          mode = "done";
        }
      }
    }
  }
};

const createDemoStream = async function* () {
  const response = createDemoText();
  const chunkSize = 20;

  for (let index = 0; index < response.length; index += chunkSize) {
    yield response.slice(index, index + chunkSize);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

export const createGeminiClient = (): GeminiClient => {
  const model = normalizeModel(env.GEMINI_MODEL || DEFAULT_MODEL);
  const apiKey = env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn(GEMINI_WARNING);
  }

  return {
    apiKey,
    model,
    endpoint: buildEndpoint(model),
    demoMode: !Boolean(apiKey)
  };
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
      required: ["query"]
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
      required: ["contactId", "description", "dueDate"]
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
      required: ["opportunityId", "stage"]
    }
  },
  {
    name: "fetchBusinessMetrics",
    description: "Fetch current dashboard KPIs for the tenant.",
    parameters: {
      type: "object",
      properties: {},
      required: []
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
      required: ["contactId", "message"]
    }
  }
];

export const chat = async (client: GeminiClient, options: GeminiChatOptions): Promise<string> => {
  if (client.demoMode) {
    return createDemoText();
  }

  const payload = toGenerateContentRequest(options);
  const response = await fetch(`${client.endpoint}:generateContent${getApiKeyQuery(client.apiKey ?? "")}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw createGeminiError(response, body);
  }

  const body = (await response.json()) as unknown;
  return extractTextFromResponse(body);
};

export const streamGenerateContentEvents = async function* (
  client: GeminiClient,
  options: GeminiStreamOptions
): AsyncGenerator<GeminiStreamEvent, void, void> {
  if (client.demoMode) {
    for await (const chunk of createDemoStream()) {
      yield { type: "text", text: chunk };
    }

    return;
  }

  const payload = toGenerateContentRequest({
    messages: options.messages,
    temperature: DEFAULT_TEMPERATURE,
    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
    functionDefinitions: options.functionDefinitions
  });

  const response = await fetch(`${client.endpoint}:streamGenerateContent${getApiKeyQuery(client.apiKey ?? "")}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw createGeminiError(response, body);
  }

  for await (const payloadChunk of readSsePayloads(response)) {
    for (const event of extractStreamEvents(payloadChunk)) {
      yield event;
    }
  }
};

export const streamChat = async function* (
  client: GeminiClient,
  options: GeminiStreamOptions
): AsyncGenerator<string, void, void> {
  if (client.demoMode) {
    yield* createDemoStream();
    return;
  }

  for await (const event of streamGenerateContentEvents(client, options)) {
    if (event.type === "text") {
      yield event.text;
    }
  }
};