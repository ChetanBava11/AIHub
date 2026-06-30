import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";

export const Route = createFileRoute("/tasks")({
  head: () => ({ meta: [{ title: "Tasks | AIHub" }] }),
  component: Tasks,
});

function Tasks() {
  return (
    <AppShell title="Tasks">
      <div className="max-w-2xl rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
        <p className="mt-2 text-sm text-gray-600">
          This protected workspace is ready for authenticated users. Task management
          workflows will be connected in a later backend phase.
        </p>
      </div>
    </AppShell>
  );
}
