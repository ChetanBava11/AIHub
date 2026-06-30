import { Link, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { opportunities } from "./opportunities";

export const Route = createFileRoute("/opportunities/$id")({
  head: () => ({ meta: [{ title: "Opportunity | AIHub" }] }),
  component: OpportunityDetail,
});

const timeline = [
  { time: "Today 10:24 AM", text: "Stage moved to Proposal" },
  { time: "Yesterday", text: "Email sent: Proposal v1.pdf" },
  { time: "2 days ago", text: "Call logged (15 min)" },
  { time: "3 days ago", text: "Opportunity created" },
];

function OpportunityDetail() {
  const { id } = Route.useParams();
  const opportunity = opportunities.find((item) => item.id === id);

  if (!opportunity) {
    return (
      <AppShell title="Opportunity">
        <p className="text-sm text-gray-600">
          Not found.{" "}
          <Link to="/opportunities" className="text-blue-700 hover:underline">
            Back
          </Link>
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title={opportunity.name}>
      <div className="mb-4">
        <Link to="/opportunities" className="text-sm text-blue-700 hover:underline">
          Back to opportunities
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">Info</h2>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-gray-500">Contact</dt>
            <dd>{opportunity.contact}</dd>
            <dt className="text-gray-500">Value</dt>
            <dd>${opportunity.value.toLocaleString()}</dd>
            <dt className="text-gray-500">Stage</dt>
            <dd>{opportunity.stage}</dd>
            <dt className="text-gray-500">Created</dt>
            <dd>Jun 24, 2026</dd>
            <dt className="text-gray-500">Expected close</dt>
            <dd>Jul 15, 2026</dd>
          </dl>
        </div>

        <div className="rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">AI Next Best Action</h2>
          <p className="text-sm text-gray-800">
            Send a follow-up email referencing pricing concerns from the last call,
            and propose a 20-minute call this week.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-2 text-sm font-medium">
          Activity Timeline
        </div>
        <ul className="divide-y divide-gray-100 text-sm">
          {timeline.map((item, index) => (
            <li key={index} className="flex gap-4 px-4 py-2">
              <span className="w-36 text-gray-500">{item.time}</span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
