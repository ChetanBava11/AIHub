import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../providers/AuthProvider";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings | AIHub" }] }),
  component: Settings,
});

function Settings() {
  const { currentTenant } = useAuth();

  return (
    <AppShell title="Settings">
      <div className="max-w-xl space-y-4 rounded border border-gray-200 bg-white p-5">
        <div>
          <label className="block text-sm text-gray-700">Business Name</label>
          <input
            readOnly
            value={currentTenant?.name ?? "Not set yet"}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Tenant ID</label>
          <input
            readOnly
            value={currentTenant?.id ?? ""}
            className="mt-1 w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Industry</label>
          <input
            readOnly
            value={currentTenant?.industry ?? "Not set yet"}
            className="mt-1 w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Workspace Status</label>
          <div className="mt-1 inline-block rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs">
            Managed by backend
          </div>
        </div>
        <div>
          <p className="text-sm text-gray-600">
            Tenant details, onboarding, and authentication are synchronized from the backend.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
