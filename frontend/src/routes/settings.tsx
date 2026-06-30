import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "../components/AppShell";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — OpsCRM" }] }),
  component: Settings,
});

function Settings() {
  const [name, setName] = useState("Acme Operations");
  const tenantId = "tnt_8f3a91";
  const whatsapp = "Not Connected";
  return (
    <AppShell title="Settings">
      <form className="max-w-xl space-y-4 rounded border border-gray-200 bg-white p-5">
        <div>
          <label className="block text-sm text-gray-700">Business Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Tenant ID</label>
          <input
            readOnly
            value={tenantId}
            className="mt-1 w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700">WhatsApp API Status</label>
          <div className="mt-1 inline-block rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs">
            {whatsapp}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium">Environment Variables</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-600">
            <li>WHATSAPP_API_KEY — required to enable WhatsApp channel</li>
            <li>EMAIL_SMTP_URL — required to send outbound emails</li>
            <li>OPENAI_API_KEY — required for AI assistant responses</li>
          </ul>
        </div>
        <div>
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save changes
          </button>
        </div>
      </form>
    </AppShell>
  );
}