import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../components/PageState";
import { getApiErrorMessage } from "../lib/api";
import { inboxService, type InboxConversation, type InboxMessageRecord, type InboxThread } from "../services/inboxService";

export const Route = createFileRoute("/inbox")({
  head: () => ({ meta: [{ title: "Inbox | AIHub" }] }),
  component: Inbox,
});

const formatMessageTime = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

function Inbox() {
  const queryClient = useQueryClient();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const conversationsQuery = useQuery({
    queryKey: ["inbox"],
    queryFn: () => inboxService.listConversations(),
  });

  const seedMutation = useMutation({
    mutationFn: () => inboxService.seedDemoData(),
    onSuccess: async () => {
      toast.success("Demo inbox data seeded.");
      await queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not seed demo inbox data.")),
  });

  const conversations = conversationsQuery.data ?? [];

  useEffect(() => {
    if (!selectedContactId && conversations[0]) {
      setSelectedContactId(conversations[0].contact.id);
    }
  }, [conversations, selectedContactId]);

  const threadQuery = useQuery({
    queryKey: ["inbox", selectedContactId],
    queryFn: () => inboxService.getConversation(selectedContactId ?? ""),
    enabled: Boolean(selectedContactId),
  });

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.contact.id === selectedContactId) ?? null,
    [conversations, selectedContactId],
  );

  if (conversationsQuery.isLoading) {
    return (
      <AppShell title="Inbox">
        <PageLoadingState title="Loading inbox" description="Fetching live conversations from the backend." />
      </AppShell>
    );
  }

  if (conversationsQuery.isError) {
    return (
      <AppShell title="Inbox">
        <PageErrorState
          title="Inbox unavailable"
          description="We could not load your conversations right now."
          actionLabel="Retry"
          onAction={() => conversationsQuery.refetch()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Inbox">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => void seedMutation.mutateAsync()}
          disabled={seedMutation.isPending}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {seedMutation.isPending ? "Seeding..." : "Seed Demo Data"}
        </button>
      </div>

      {conversations.length === 0 ? (
        <PageEmptyState
          title="Inbox is empty"
          description="Seed demo conversations or wait for live messages to arrive."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-3 py-2 text-sm font-medium">
              Conversations
            </div>
            <ul>
              {conversations.map((item) => (
                <li key={item.contact.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedContactId(item.contact.id)}
                    className={
                      "block w-full border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50 " +
                      (item.contact.id === selectedContactId ? "bg-blue-50" : "")
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.contact.name}</span>
                      <span className="text-xs text-gray-500">[{item.lastMessage.channel}]</span>
                    </div>
                    <div className="truncate text-xs text-gray-600">{item.lastMessage.content}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded border border-gray-200 bg-white md:col-span-2">
            {threadQuery.isLoading ? (
              <div className="p-4">
                <PageLoadingState title="Loading thread" description="Fetching the selected conversation." />
              </div>
            ) : threadQuery.isError ? (
              <div className="p-4">
                <PageErrorState
                  title="Conversation unavailable"
                  description="We could not load this conversation."
                  actionLabel="Retry"
                  onAction={() => threadQuery.refetch()}
                />
              </div>
            ) : selectedConversation && threadQuery.data ? (
              <ThreadView conversation={selectedConversation} thread={threadQuery.data} />
            ) : (
              <div className="p-4">
                <PageEmptyState
                  title="Select a conversation"
                  description="Choose a contact from the list to view the thread."
                />
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ThreadView({
  conversation,
  thread,
}: {
  conversation: InboxConversation;
  thread: InboxThread;
}) {
  return (
    <>
      <div className="border-b border-gray-200 p-3">
        <div className="text-sm font-medium">
          {thread.contact.name} - {conversation.lastMessage.channel}
        </div>
        <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2 text-xs">
          <div>
            <span className="text-gray-500">Email:</span> {thread.contact.email ?? "-"}
          </div>
          <div>
            <span className="text-gray-500">Company:</span> {thread.contact.company ?? "-"}
          </div>
          <div>
            <span className="text-gray-500">Latest Message:</span> {conversation.lastMessage.content}
          </div>
        </div>
      </div>
      <div className="space-y-2 p-3">
        {thread.messages.map((message) => (
          <div
            key={`${message.createdAt}-${message.content}`}
            className={"flex " + (message.direction === "out" ? "justify-end" : "justify-start")}
          >
            <div
              className={
                "max-w-[70%] rounded border px-3 py-2 text-sm " +
                (message.direction === "out"
                  ? "border-blue-200 bg-blue-50"
                  : "border-gray-200 bg-gray-50")
              }
            >
              <div>{message.content}</div>
              <div className="mt-1 text-[10px] text-gray-500">{formatMessageTime(message.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
