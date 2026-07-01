import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [{ title: "AI Assistant | AIHub" }] }),
  component: Assistant,
});

function Assistant() {
  return (
    <AppShell title="AI Assistant">
      <div className="max-w-2xl rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
        <p className="mt-2 text-sm text-gray-600">
          Assistant workflows are not connected in Phase 2. The page remains available for later
          expansion, but it no longer uses local mock responses.
        </p>
      </div>
    </AppShell>
  );
}
