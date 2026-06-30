import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard | AIHub" }] }),
  component: Dashboard,
});

const kpis = [
  { label: "Active Opportunities", value: 24 },
  { label: "Revenue Pipeline", value: "$128,400" },
  { label: "Pending Follow-ups", value: 7 },
  { label: "Customer Activity", value: 142 },
  { label: "AI Alerts", value: 3 },
];

const activity = [
  { time: "10:24 AM", text: "New opportunity created: Acme Co. - $12,000" },
  { time: "09:55 AM", text: "Email received from Jane Doe (Globex)" },
  { time: "Yesterday", text: "Call logged with Michael Smith" },
  { time: "Yesterday", text: "Opportunity moved to Proposal: Initech" },
  { time: "2 days ago", text: "WhatsApp reply from Sarah Lee" },
];

function Dashboard() {
  return (
    <AppShell title="Dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((item) => (
          <div key={item.label} className="rounded border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">{item.label}</div>
            <div className="mt-1 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-2 text-sm font-medium">
          Recent Activity
        </div>
        <table className="w-full text-sm">
          <tbody>
            {activity.map((item, index) => (
              <tr key={index} className="border-b border-gray-100 last:border-0">
                <td className="w-32 px-4 py-2 text-gray-500">{item.time}</td>
                <td className="px-4 py-2">{item.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
