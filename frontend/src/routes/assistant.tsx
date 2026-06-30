import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "../components/AppShell";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [{ title: "AI Assistant — OpsCRM" }] }),
  component: Assistant,
});

type Msg = { role: "user" | "ai"; text: string; why?: string };

const initial: Msg[] = [
  {
    role: "ai",
    text: "Hi! Ask me anything about your pipeline, contacts, or next steps.",
    why: "Greeting on first load; no context yet.",
  },
];

function Assistant() {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [openWhy, setOpenWhy] = useState<Record<number, boolean>>({});

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: "Based on your pipeline, I'd recommend following up with Globex first — high value and they've been quiet for 3 days.",
          why: "Globex opportunity is $45k (largest open). Last contact was 3 days ago, above typical follow-up cadence.",
        },
      ]);
      setTyping(false);
    }, 600);
  }

  return (
    <AppShell title="AI Assistant">
      <div className="flex h-[70vh] flex-col rounded border border-gray-200 bg-white">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div key={i} className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}>
              <div className="max-w-[75%]">
                <div
                  className={
                    "rounded border px-3 py-2 text-sm " +
                    (m.role === "user"
                      ? "border-blue-200 bg-blue-50"
                      : "border-gray-200 bg-gray-50")
                  }
                >
                  {m.text}
                </div>
                {m.role === "ai" && m.why && (
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => setOpenWhy((s) => ({ ...s, [i]: !s[i] }))}
                      className="text-xs text-blue-700 hover:underline"
                    >
                      {openWhy[i] ? "Hide" : "Why this action"}
                    </button>
                    {openWhy[i] && (
                      <div className="mt-1 text-xs text-gray-600">{m.why}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {typing && <div className="text-xs text-gray-500">AI is typing...</div>}
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-gray-200 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the assistant..."
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Send
          </button>
        </form>
      </div>
    </AppShell>
  );
}