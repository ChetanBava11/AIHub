import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "../components/AppShell";

export const Route = createFileRoute("/inbox")({
  head: () => ({ meta: [{ title: "Inbox | AIHub" }] }),
  component: Inbox,
});

type Message = { from: "them" | "me"; text: string; time: string };
type Conversation = {
  id: string;
  name: string;
  channel: "WhatsApp" | "Email" | "Call";
  preview: string;
  sentiment: "Positive" | "Negative" | "Neutral";
  intent: string;
  nextAction: string;
  messages: Message[];
};

const conversations: Conversation[] = [
  {
    id: "1",
    name: "Sarah Lee",
    channel: "WhatsApp",
    preview: "Sounds good, send the proposal",
    sentiment: "Positive",
    intent: "Requesting proposal",
    nextAction: "Send proposal v1 today",
    messages: [
      { from: "them", text: "Hi! Can you share more details on pricing?", time: "9:10" },
      { from: "me", text: "Sure - sending a one-pager shortly.", time: "9:12" },
      { from: "them", text: "Sounds good, send the proposal", time: "9:14" },
    ],
  },
  {
    id: "2",
    name: "Michael Smith",
    channel: "Email",
    preview: "We need to push the meeting...",
    sentiment: "Neutral",
    intent: "Reschedule meeting",
    nextAction: "Offer 3 new time slots",
    messages: [{ from: "them", text: "We need to push the meeting to next week.", time: "Mon" }],
  },
  {
    id: "3",
    name: "Raj Patel",
    channel: "Call",
    preview: "Voicemail (1:23)",
    sentiment: "Negative",
    intent: "Support escalation",
    nextAction: "Call back within 1 hour",
    messages: [{ from: "them", text: "Left a voicemail - issue with billing.", time: "Tue" }],
  },
];

function Inbox() {
  const [selectedId, setSelectedId] = useState(conversations[0].id);
  const conversation = conversations.find((item) => item.id === selectedId) ?? conversations[0];

  return (
    <AppShell title="Inbox">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-3 py-2 text-sm font-medium">
            Conversations
          </div>
          <ul>
            {conversations.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setSelectedId(item.id)}
                  className={
                    "block w-full border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50 " +
                    (item.id === selectedId ? "bg-blue-50" : "")
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-xs text-gray-500">[{item.channel}]</span>
                  </div>
                  <div className="truncate text-xs text-gray-600">{item.preview}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded border border-gray-200 bg-white md:col-span-2">
          <div className="border-b border-gray-200 p-3">
            <div className="text-sm font-medium">
              {conversation.name} - {conversation.channel}
            </div>
            <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2 text-xs">
              <div>
                <span className="text-gray-500">Sentiment:</span> {conversation.sentiment}
              </div>
              <div>
                <span className="text-gray-500">Intent:</span> {conversation.intent}
              </div>
              <div>
                <span className="text-gray-500">Recommended Next Action:</span>{" "}
                {conversation.nextAction}
              </div>
            </div>
          </div>
          <div className="space-y-2 p-3">
            {conversation.messages.map((message, index) => (
              <div
                key={index}
                className={"flex " + (message.from === "me" ? "justify-end" : "justify-start")}
              >
                <div
                  className={
                    "max-w-[70%] rounded border px-3 py-2 text-sm " +
                    (message.from === "me"
                      ? "border-blue-200 bg-blue-50"
                      : "border-gray-200 bg-gray-50")
                  }
                >
                  <div>{message.text}</div>
                  <div className="mt-1 text-[10px] text-gray-500">{message.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
