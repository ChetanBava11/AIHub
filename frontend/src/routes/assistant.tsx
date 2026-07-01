import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../components/PageState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { getApiErrorMessage } from "../lib/api";
import {
  aiService,
  type AIMessageRecord,
} from "../services/aiService";
import { workflowService, type WorkflowResult } from "../services/workflowService";

type ChatLine = AIMessageRecord & {
  pending?: boolean;
};

type ToolEvent =
  | { id: string; type: "tool_call"; tool: string; status: string }
  | { id: string; type: "tool_result"; tool: string; success: boolean; result: unknown; error?: string };

type WorkflowFormState = {
  name: string;
  phone: string;
  email: string;
  company: string;
  notes: string;
};

const emptyWorkflowForm = (): WorkflowFormState => ({
  name: "",
  phone: "",
  email: "",
  company: "",
  notes: "",
});

const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const toolLabel: Record<string, string> = {
  searchContacts: "Searching contacts...",
  createTask: "Creating task...",
  updateOpportunity: "Updating opportunity...",
  sendWhatsApp: "Sending WhatsApp...",
  fetchBusinessMetrics: "Fetching business metrics...",
};

function AssistantPage() {
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [draftMessage, setDraftMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [workflowForm, setWorkflowForm] = useState<WorkflowFormState>(emptyWorkflowForm());
  const [workflowResult, setWorkflowResult] = useState<WorkflowResult | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const conversationsQuery = useQuery({
    queryKey: ["ai", "conversations"],
    queryFn: () => aiService.listConversations(),
  });

  const activeConversationQuery = useQuery({
    queryKey: ["ai", "conversation", selectedConversationId],
    queryFn: () => aiService.getConversation(selectedConversationId ?? ""),
    enabled: Boolean(selectedConversationId),
  });

  useEffect(() => {
    const conversations = conversationsQuery.data ?? [];

    if (!selectedConversationId && conversations[0]) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversationsQuery.data, selectedConversationId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [streamingText, activeConversationQuery.data]);

  const messages = useMemo<ChatLine[]>(() => {
    const baseMessages = activeConversationQuery.data?.messages ?? [];

    if (!isStreaming || !draftMessage.trim()) {
      return baseMessages;
    }

    return [
      ...baseMessages,
      {
        id: "pending-assistant-message",
        conversationId: selectedConversationId ?? "",
        role: "assistant",
        content: streamingText,
        explanation: null,
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ];
  }, [activeConversationQuery.data?.messages, draftMessage, isStreaming, selectedConversationId, streamingText]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      setAssistantError(null);
      setIsStreaming(true);
      setStreamingText("");
      setToolEvents([]);

      return aiService.streamChat(
        {
          conversationId: selectedConversationId,
          message,
        },
        {
          onConversationStarted: (conversationId) => {
            setSelectedConversationId(conversationId);
          },
          onAssistantChunk: (chunk) => {
            setStreamingText((current) => current + chunk);
          },
          onToolCall: (tool, status) => {
            setToolEvents((current) => [
              ...current,
              { id: `${tool}-${Date.now()}-${current.length}`, type: "tool_call", tool, status },
            ]);
          },
          onToolResult: (event) => {
            setToolEvents((current) => [
              ...current,
              {
                id: `${event.tool}-${Date.now()}-${current.length}`,
                type: "tool_result",
                tool: event.tool,
                success: event.success,
                result: event.result,
                error: event.error,
              },
            ]);
          },
          onAssistantFinal: (text) => {
            setStreamingText(text);
          },
          onError: (message) => {
            setAssistantError(message);
          },
        },
      );
    },
    onSuccess: async (result) => {
      setIsStreaming(false);
      setDraftMessage("");
      setStreamingText("");
      await queryClient.invalidateQueries({ queryKey: ["ai", "conversations"] });

      if (result.conversationId) {
        setSelectedConversationId(result.conversationId);
        await queryClient.invalidateQueries({ queryKey: ["ai", "conversation", result.conversationId] });
      }
    },
    onError: (error) => {
      setIsStreaming(false);
      const message = getApiErrorMessage(error, "We could not stream the assistant response.");
      setAssistantError(message);
      toast.error(message);
    },
  });

  const workflowMutation = useMutation({
    mutationFn: (payload: WorkflowFormState) =>
      workflowService.qualifyLead({
        name: payload.name,
        phone: payload.phone,
        email: payload.email || undefined,
        company: payload.company || undefined,
        notes: payload.notes || undefined,
      }),
    onSuccess: (result) => {
      setWorkflowResult(result);
      setWorkflowError(null);
      toast.success("Lead qualified.");
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "We could not qualify the lead.");
      setWorkflowError(message);
      toast.error(message);
    },
  });

  if (conversationsQuery.isLoading) {
    return (
      <AppShell title="AI Assistant">
        <PageLoadingState title="Loading AI Assistant" description="Fetching your conversation history." />
      </AppShell>
    );
  }

  if (conversationsQuery.isError) {
    return (
      <AppShell title="AI Assistant">
        <PageErrorState
          title="AI Assistant unavailable"
          description="We could not load your conversations."
          actionLabel="Retry"
          onAction={() => conversationsQuery.refetch()}
        />
      </AppShell>
    );
  }

  const conversationList = conversationsQuery.data ?? [];
  const currentConversation = activeConversationQuery.data?.conversation ?? null;
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant") ?? null;

  return (
    <AppShell title="AI Assistant">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
            <CardDescription>Select a previous thread or start a new one below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {conversationList.length === 0 ? (
              <PageEmptyState title="No conversations yet" description="Send a message to start a new thread." />
            ) : (
              conversationList.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={
                    "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors " +
                    (conversation.id === selectedConversationId
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent")
                  }
                >
                  <div className="font-medium text-foreground">{conversation.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatTimestamp(conversation.createdAt)}</div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chat</CardTitle>
              <CardDescription>Streaming assistant responses with tool timeline and explanations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="space-y-3 overflow-y-auto rounded-lg border border-border bg-background p-4"
                style={{ maxHeight: "28rem" }}
              >
                {messages.length === 0 ? (
                  <PageEmptyState title="Start a conversation" description="Ask about contacts, tasks, opportunities, or metrics." />
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
                      <div
                        className={
                          "inline-block max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm " +
                          (message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-card text-card-foreground")
                        }
                      >
                        <div className="flex items-center gap-2 text-xs opacity-80">
                          <span>{message.role === "user" ? "You" : "Assistant"}</span>
                          <span>•</span>
                          <span>{formatTimestamp(message.createdAt)}</span>
                          {message.pending ? <LoaderCircle className="h-3 w-3 animate-spin" /> : null}
                        </div>
                        <div className="mt-2 whitespace-pre-wrap">{message.content}</div>
                        {message.role === "assistant" && message.explanation ? (
                          <div className="mt-2 rounded-md border border-dashed border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                            {message.explanation}
                          </div>
                        ) : null}
                        {Array.isArray(message.toolCalls) && message.toolCalls.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {message.toolCalls.map((toolCall, index) => (
                              <Badge key={`${message.id}-${index}`} variant="outline">
                                {typeof toolCall === "object" && toolCall && "tool" in toolCall
                                  ? String((toolCall as { tool?: unknown }).tool)
                                  : "tool"}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
                {isStreaming ? (
                  <div className="text-left">
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Typing...
                    </div>
                  </div>
                ) : null}
                <div ref={chatEndRef} />
              </div>

              {toolEvents.length > 0 ? (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4" />
                    Tool execution timeline
                  </div>
                  <div className="space-y-2 text-sm">
                    {toolEvents.map((event) => (
                      <div key={event.id} className="rounded-md border border-border bg-background px-3 py-2">
                        <div className="font-medium">
                          {event.type === "tool_call"
                            ? toolLabel[event.tool] ?? event.status
                            : `${event.tool} ${event.success ? "completed" : "failed"}`}
                        </div>
                        {event.type === "tool_result" && event.error ? (
                          <div className="mt-1 text-xs text-destructive">{event.error}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {assistantError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {assistantError}
                </div>
              ) : null}

              <form
                className="space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();

                  const trimmedMessage = draftMessage.trim();
                  if (!trimmedMessage || isStreaming) {
                    return;
                  }

                  setStreamingText("");
                  await sendMessageMutation.mutateAsync(trimmedMessage);
                }}
              >
                <Textarea
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  rows={4}
                  placeholder="Ask the assistant to search contacts, create a task, update an opportunity, or send WhatsApp..."
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {currentConversation ? `Conversation: ${currentConversation.title}` : "New conversation"}
                  </div>
                  <Button type="submit" disabled={isStreaming || !draftMessage.trim()}>
                    {isStreaming ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {isStreaming ? "Streaming" : "Send"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Workflow Automation</CardTitle>
                <CardDescription>Qualify a lead and capture score, reasoning, and actions taken.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    await workflowMutation.mutateAsync(workflowForm);
                  }}
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Input placeholder="Name" value={workflowForm.name} onChange={(event) => setWorkflowForm({ ...workflowForm, name: event.target.value })} />
                    <Input placeholder="Phone" value={workflowForm.phone} onChange={(event) => setWorkflowForm({ ...workflowForm, phone: event.target.value })} />
                    <Input placeholder="Email" value={workflowForm.email} onChange={(event) => setWorkflowForm({ ...workflowForm, email: event.target.value })} />
                    <Input placeholder="Company" value={workflowForm.company} onChange={(event) => setWorkflowForm({ ...workflowForm, company: event.target.value })} />
                  </div>
                  <Textarea placeholder="Notes" rows={4} value={workflowForm.notes} onChange={(event) => setWorkflowForm({ ...workflowForm, notes: event.target.value })} />
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">Lead qualification uses the backend workflow endpoint.</div>
                    <Button type="submit" disabled={workflowMutation.isPending}>
                      {workflowMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                      Qualify Lead
                    </Button>
                  </div>
                </form>

                {workflowError ? (
                  <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {workflowError}
                  </div>
                ) : null}

                {workflowResult ? (
                  <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/20 p-4 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Lead Score</div>
                      <div className="text-2xl font-semibold">{workflowResult.score}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Reasoning</div>
                      <p className="mt-1 whitespace-pre-wrap">{workflowResult.reasoning}</p>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Actions Taken</div>
                      <ul className="mt-1 space-y-1">
                        {workflowResult.actionsTaken.length > 0 ? (
                          workflowResult.actionsTaken.map((action, index) => (
                            <li key={`${action.type}-${index}`}>
                              {action.type === "whatsapp"
                                ? `WhatsApp sent: ${action.message}`
                                : `Task created for ${action.dueDate}`}
                            </li>
                          ))
                        ) : (
                          <li>No automated actions were triggered.</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Workflow Status</div>
                      <div className="mt-1 inline-flex rounded-md border border-border bg-background px-2 py-1 text-xs font-medium">
                        {workflowResult.workflowStatus ?? "Completed"}
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversation Details</CardTitle>
                <CardDescription>Latest assistant reply, explanation, and timestamp.</CardDescription>
              </CardHeader>
              <CardContent>
                {currentConversation ? (
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Title</div>
                      <div>{currentConversation.title}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Timestamp</div>
                      <div>{formatTimestamp(currentConversation.createdAt)}</div>
                    </div>
                    {latestAssistantMessage ? (
                      <>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Assistant Response</div>
                          <div className="mt-1 whitespace-pre-wrap">{latestAssistantMessage.content}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Explanation</div>
                          <div className="mt-1 whitespace-pre-wrap text-muted-foreground">
                            {latestAssistantMessage.explanation ?? "No explanation returned yet."}
                          </div>
                        </div>
                      </>
                    ) : (
                      <PageEmptyState title="No assistant response yet" description="Send a message to populate the conversation details." />
                    )}
                  </div>
                ) : (
                  <PageEmptyState title="No conversation selected" description="Choose a conversation from the list." />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [{ title: "AI Assistant | AIHub" }] }),
  component: AssistantPage,
});
