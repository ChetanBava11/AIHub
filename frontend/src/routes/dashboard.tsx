import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { PageErrorState, PageLoadingState } from "../components/PageState";
import { dashboardService } from "../services/dashboardService";
import { useQuery } from "@tanstack/react-query";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard | AIHub" }] }),
  component: Dashboard,
});

function Dashboard() {
  const kpisQuery = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: () => dashboardService.getKpis(),
  });

  if (kpisQuery.isLoading) {
    return (
      <AppShell title="Dashboard">
        <PageLoadingState title="Loading dashboard" description="Fetching live metrics from your tenant." />
      </AppShell>
    );
  }

  if (kpisQuery.isError) {
    return (
      <AppShell title="Dashboard">
        <PageErrorState
          title="Dashboard unavailable"
          description="We could not load your live KPI data."
          actionLabel="Retry"
          onAction={() => kpisQuery.refetch()}
        />
      </AppShell>
    );
  }

  const kpis = kpisQuery.data;

  return (
    <AppShell title="Dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">Active Opportunities</div>
          <div className="mt-1 text-2xl font-semibold">{kpis.activeOpportunitiesCount}</div>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">Revenue Pipeline</div>
          <div className="mt-1 text-2xl font-semibold">
            {currencyFormatter.format(kpis.revenuePipelineSum)}
          </div>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">Pending Follow-ups</div>
          <div className="mt-1 text-2xl font-semibold">{kpis.pendingFollowupsCount}</div>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">Customer Activity</div>
          <div className="mt-1 text-2xl font-semibold">{kpis.customerActivityCount}</div>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">AI Alerts</div>
          <div className="mt-1 text-2xl font-semibold">{kpis.aiAlertsCount}</div>
        </div>
      </div>

      <div className="mt-6 rounded border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-900">Live workspace snapshot</h2>
        <p className="mt-2 text-sm text-gray-600">
          These metrics are loaded directly from the backend and scoped to the current tenant.
        </p>
      </div>
    </AppShell>
  );
}
