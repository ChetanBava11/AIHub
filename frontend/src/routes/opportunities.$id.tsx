import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { PageErrorState, PageLoadingState } from "../components/PageState";
import { getApiErrorMessage } from "../lib/api";
import { contactService, type ContactRecord } from "../services/contactService";
import {
  opportunityService,
  type OpportunityInput,
  type OpportunityStage,
} from "../services/opportunityService";

export const Route = createFileRoute("/opportunities/$id")({
  head: () => ({ meta: [{ title: "Opportunity | AIHub" }] }),
  component: OpportunityDetail,
});

type OpportunityFormState = {
  contactId: string;
  title: string;
  value: string;
  stage: OpportunityStage;
  aiNextBestAction: string;
};

const stages: OpportunityStage[] = ["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
const stageLabels: Record<OpportunityStage, string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  WON: "Won",
  LOST: "Lost",
};

const toForm = (opportunity: OpportunityDetailData | null): OpportunityFormState => ({
  contactId: opportunity?.contact.id ?? "",
  title: opportunity?.title ?? "",
  value: opportunity ? String(opportunity.value) : "",
  stage: opportunity?.stage ?? "NEW",
  aiNextBestAction: opportunity?.aiNextBestAction ?? "",
});

type OpportunityDetailData = {
  id: string;
  tenantId: string;
  contactId: string;
  title: string;
  value: string | number;
  stage: OpportunityStage;
  aiNextBestAction: string | null;
  createdAt: string;
  updatedAt: string;
  contact: ContactRecord;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

function OpportunityDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = Route.useParams();
  const [isEditing, setIsEditing] = useState(false);

  const opportunityQuery = useQuery({
    queryKey: ["opportunity", id],
    queryFn: () => opportunityService.getOpportunityById(id),
  });

  const contactsQuery = useQuery({
    queryKey: ["contacts", "opportunity-detail-select"],
    queryFn: () => contactService.listContacts(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ opportunityId, payload }: { opportunityId: string; payload: Partial<OpportunityInput> }) =>
      opportunityService.updateOpportunity(opportunityId, payload),
    onSuccess: async () => {
      toast.success("Opportunity updated.");
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["opportunity", id] });
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not update the opportunity.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (opportunityId: string) => opportunityService.deleteOpportunity(opportunityId),
    onSuccess: async () => {
      toast.success("Opportunity deleted.");
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      await navigate({ to: "/opportunities", replace: true });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not delete the opportunity.")),
  });

  if (opportunityQuery.isLoading || contactsQuery.isLoading) {
    return (
      <AppShell title="Opportunity">
        <PageLoadingState title="Loading opportunity" description="Fetching the live opportunity record." />
      </AppShell>
    );
  }

  if (opportunityQuery.isError || contactsQuery.isError) {
    return (
      <AppShell title="Opportunity">
        <PageErrorState
          title="Opportunity unavailable"
          description="We could not load this record right now."
          actionLabel="Retry"
          onAction={() => {
            void opportunityQuery.refetch();
            void contactsQuery.refetch();
          }}
        />
      </AppShell>
    );
  }

  const opportunity = opportunityQuery.data?.opportunity as OpportunityDetailData | undefined;

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
    <AppShell title={opportunity.title}>
      <div className="mb-4">
        <Link to="/opportunities" className="text-sm text-blue-700 hover:underline">
          Back to opportunities
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Edit Opportunity
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete ${opportunity.title}?`)) {
              void deleteMutation.mutateAsync(opportunity.id);
            }
          }}
          className="rounded border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Delete Opportunity
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">Info</h2>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-gray-500">Contact</dt>
            <dd>{opportunity.contact.name}</dd>
            <dt className="text-gray-500">Value</dt>
            <dd>${Number(opportunity.value).toLocaleString()}</dd>
            <dt className="text-gray-500">Stage</dt>
            <dd>{stageLabels[opportunity.stage]}</dd>
            <dt className="text-gray-500">Created</dt>
            <dd>{formatDateTime(opportunity.createdAt)}</dd>
            <dt className="text-gray-500">Updated</dt>
            <dd>{formatDateTime(opportunity.updatedAt)}</dd>
          </dl>
        </div>

        <div className="rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">AI Next Best Action</h2>
          <p className="text-sm text-gray-800">
            {opportunity.aiNextBestAction ?? "No next best action has been captured yet."}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-2 text-sm font-medium">
          Activity Timeline
        </div>
        <ul className="divide-y divide-gray-100 text-sm">
          {opportunityQuery.data?.recentMessages.map((message) => (
            <li key={`${message.createdAt}-${message.content}`} className="flex gap-4 px-4 py-2">
              <span className="w-36 text-gray-500">{formatDateTime(message.createdAt)}</span>
              <span>{message.content}</span>
            </li>
          ))}
        </ul>
      </div>

      <OpportunityDialog
        open={isEditing}
        contacts={contactsQuery.data ?? []}
        initialValue={toForm(opportunity)}
        submitting={updateMutation.isPending}
        onOpenChange={setIsEditing}
        onSubmit={async (form) => {
          await updateMutation.mutateAsync({
            opportunityId: opportunity.id,
            payload: {
              contactId: form.contactId,
              title: form.title,
              value: Number(form.value),
              stage: form.stage,
              aiNextBestAction: form.aiNextBestAction || undefined,
            },
          });
        }}
      />
    </AppShell>
  );
}

function OpportunityDialog({
  open,
  contacts,
  initialValue,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  contacts: ContactRecord[];
  initialValue: OpportunityFormState;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: OpportunityFormState) => Promise<void>;
}) {
  const [form, setForm] = useState(initialValue);

  useEffect(() => {
    if (open) {
      setForm(initialValue);
    }
  }, [initialValue, open]);

  return (
    <div className={open ? "fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" : "hidden"}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await onSubmit(form);
        }}
        className="w-full max-w-md rounded border border-gray-200 bg-white p-5"
      >
        <h2 className="mb-3 text-base font-semibold">Edit Opportunity</h2>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-gray-600">Contact</label>
            <select
              required
              value={form.contactId}
              onChange={(event) => setForm({ ...form, contactId: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select a contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600">Title</label>
            <input
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Value</label>
            <input
              required
              type="number"
              min="0"
              value={form.value}
              onChange={(event) => setForm({ ...form, value: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Stage</label>
            <select
              value={form.stage}
              onChange={(event) => setForm({ ...form, stage: event.target.value as OpportunityStage })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {stages.map((stage) => (
                <option key={stage} value={stage}>
                  {stageLabels[stage]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600">AI Next Best Action</label>
            <textarea
              value={form.aiNextBestAction}
              onChange={(event) => setForm({ ...form, aiNextBestAction: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              rows={4}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
