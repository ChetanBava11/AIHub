import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";

export const Route = createFileRoute("/opportunities")({
  head: () => ({ meta: [{ title: "Opportunities — OpsCRM" }] }),
  component: Opportunities,
});

export const opportunities = [
  { id: "1", name: "Acme Co. — Website Redesign", value: 12000, contact: "Sarah Lee", stage: "New" },
  { id: "2", name: "Globex — CRM Rollout", value: 45000, contact: "Jane Doe", stage: "Qualified" },
  { id: "3", name: "Initech — Support Plan", value: 8000, contact: "Michael Smith", stage: "Proposal" },
  { id: "4", name: "Umbrella — Data Migration", value: 22000, contact: "Raj Patel", stage: "Proposal" },
  { id: "5", name: "Wayne — Annual Renewal", value: 30000, contact: "Bruce W.", stage: "Won" },
  { id: "6", name: "Soylent — Trial", value: 5000, contact: "Eli L.", stage: "Lost" },
];

const stages = ["New", "Qualified", "Proposal", "Won", "Lost"] as const;

function Opportunities() {
  return (
    <AppShell title="Opportunities">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {stages.map((s) => {
          const items = opportunities.filter((o) => o.stage === s);
          return (
            <div key={s} className="rounded border border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-3 py-2 text-sm font-medium">
                {s} <span className="text-gray-500">({items.length})</span>
              </div>
              <div className="space-y-2 p-2">
                {items.map((o) => (
                  <Link
                    key={o.id}
                    to="/opportunities/$id"
                    params={{ id: o.id }}
                    className="block rounded border border-gray-200 p-2 text-sm hover:bg-gray-50"
                  >
                    <div className="font-medium">{o.name}</div>
                    <div className="text-xs text-gray-600">{o.contact}</div>
                    <div className="text-xs text-gray-800">${o.value.toLocaleString()}</div>
                  </Link>
                ))}
                {items.length === 0 && (
                  <div className="px-1 py-2 text-xs text-gray-400">No items</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}