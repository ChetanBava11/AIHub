import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../components/PageState";
import { getApiErrorMessage } from "../lib/api";
import { contactService, type ContactRecord } from "../services/contactService";
import {
  opportunityService,
  type OpportunityInput,
  type OpportunityRecord,
  type OpportunityStage,
} from "../services/opportunityService";

export const Route = createFileRoute("/opportunities")({
  head: () => ({ meta: [{ title: "Opportunities | AIHub" }] }),
  component: Opportunities,
});

const stages: OpportunityStage[] = ["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
const stageLabels: Record<OpportunityStage, string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  WON: "Won",
  LOST: "Lost",
};

type OpportunityFormState = {
  contactId: string;
  title: string;
  value: string;
  stage: OpportunityStage;
  aiNextBestAction: string;
};

const emptyForm = (): OpportunityFormState => ({
  contactId: "",
  title: "",
  value: "",
  stage: "NEW",
  aiNextBestAction: "",
});

const toForm = (opportunity: OpportunityRecord | null): OpportunityFormState => ({
  contactId: opportunity?.contactId ?? "",
  title: opportunity?.title ?? "",
  value: opportunity ? String(opportunity.value) : "",
  stage: opportunity?.stage ?? "NEW",
  aiNextBestAction: opportunity?.aiNextBestAction ?? "",
});

function Opportunities() {
  const [selectedStage, setSelectedStage] = useState<"ALL" | OpportunityStage>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<OpportunityRecord | null>(null);
  const queryClient = useQueryClient();

  const contactsQuery = useQuery({
    queryKey: ["contacts", "opportunity-select"],
    queryFn: () => contactService.listContacts(),
  });

  const opportunitiesQuery = useQuery({
    queryKey: ["opportunities", selectedStage],
    queryFn: () =>
      opportunityService.listOpportunities(selectedStage === "ALL" ? undefined : selectedStage),
  });

  const createMutation = useMutation({
    mutationFn: (payload: OpportunityInput) => opportunityService.createOpportunity(payload),
    onSuccess: async () => {
      toast.success("Opportunity created.");
      setIsCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not create the opportunity.")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<OpportunityInput> }) =>
      opportunityService.updateOpportunity(id, payload),
    onSuccess: async () => {
      toast.success("Opportunity updated.");
      setEditingOpportunity(null);
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not update the opportunity.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => opportunityService.deleteOpportunity(id),
    onSuccess: async () => {
      toast.success("Opportunity deleted.");
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not delete the opportunity.")),
  });

  const opportunities = opportunitiesQuery.data?.data ?? [];
  const filteredStages = useMemo(
    () => (selectedStage === "ALL" ? stages : [selectedStage]),
    [selectedStage],
  );

  useEffect(() => {
    if (editingOpportunity && !opportunities.some((item) => item.id === editingOpportunity.id)) {
      setEditingOpportunity(null);
    }
  }, [editingOpportunity, opportunities]);

  if (opportunitiesQuery.isLoading || contactsQuery.isLoading) {
    return (
      <AppShell title="Opportunities">
        <PageLoadingState title="Loading opportunities" description="Fetching live pipeline data." />
      </AppShell>
    );
  }

  if (opportunitiesQuery.isError || contactsQuery.isError) {
    return (
      <AppShell title="Opportunities">
        <PageErrorState
          title="Opportunities unavailable"
          description="We could not load the pipeline right now."
          actionLabel="Retry"
          onAction={() => {
            void opportunitiesQuery.refetch();
            void contactsQuery.refetch();
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Opportunities">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Filter</label>
          <select
            value={selectedStage}
            onChange={(event) => setSelectedStage(event.target.value as "ALL" | OpportunityStage)}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">All stages</option>
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {stageLabels[stage]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Opportunity
        </button>
      </div>

      {opportunities.length === 0 ? (
        <PageEmptyState
          title="No opportunities found"
          description="Create an opportunity to start tracking the pipeline."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {filteredStages.map((stage) => {
            const items = opportunities.filter((item) => item.stage === stage);

            return (
              <div key={stage} className="rounded border border-gray-200 bg-white">
                <div className="border-b border-gray-200 px-3 py-2 text-sm font-medium">
                  {stageLabels[stage]} <span className="text-gray-500">({items.length})</span>
                </div>
                <div className="space-y-2 p-2">
                  {items.map((opportunity) => (
                    <div key={opportunity.id} className="rounded border border-gray-200 p-2 text-sm">
                      <Link
                        to="/opportunities/$id"
                        params={{ id: opportunity.id }}
                        className="block hover:underline"
                      >
                        <div className="font-medium">{opportunity.title}</div>
                      </Link>
                      <div className="text-xs text-gray-600">
                        {contactsQuery.data?.find((contact) => contact.id === opportunity.contactId)?.name ??
                          opportunity.contactId}
                      </div>
                      <div className="mt-1 text-xs text-gray-800">${Number(opportunity.value).toLocaleString()}</div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingOpportunity(opportunity)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete ${opportunity.title}?`)) {
                              void deleteMutation.mutateAsync(opportunity.id);
                            }
                          }}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 ? (
                    <div className="px-1 py-2 text-xs text-gray-400">No items</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <OpportunityDialog
        open={isCreateOpen}
        title="Add Opportunity"
        contacts={contactsQuery.data ?? []}
        initialValue={emptyForm()}
        submitting={createMutation.isPending}
        onOpenChange={setIsCreateOpen}
        onSubmit={async (form) => {
          await createMutation.mutateAsync({
            contactId: form.contactId,
            title: form.title,
            value: Number(form.value),
            stage: form.stage,
            aiNextBestAction: form.aiNextBestAction || undefined,
          });
        }}
      />

      <OpportunityDialog
        open={editingOpportunity !== null}
        title="Edit Opportunity"
        contacts={contactsQuery.data ?? []}
        initialValue={toForm(editingOpportunity)}
        submitting={updateMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setEditingOpportunity(null);
          }
        }}
        onSubmit={async (form) => {
          if (!editingOpportunity) {
            return;
          }

          await updateMutation.mutateAsync({
            id: editingOpportunity.id,
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
  title,
  contacts,
  initialValue,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
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
        <h2 className="mb-3 text-base font-semibold">{title}</h2>
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
            Cancel
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
