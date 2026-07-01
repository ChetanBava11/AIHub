import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../components/PageState";
import { getApiErrorMessage } from "../lib/api";
import { contactService, type ContactInput, type ContactRecord } from "../services/contactService";

export const Route = createFileRoute("/contacts")({
  head: () => ({ meta: [{ title: "Contacts | AIHub" }] }),
  component: Contacts,
});

type ContactFormState = {
  name: string;
  phone: string;
  email: string;
  company: string;
  status: string;
  lastContactedAt: string;
};

const emptyContactForm = (): ContactFormState => ({
  name: "",
  phone: "",
  email: "",
  company: "",
  status: "Lead",
  lastContactedAt: "",
});

const toContactForm = (contact: ContactRecord | null): ContactFormState => ({
  name: contact?.name ?? "",
  phone: contact?.phone ?? "",
  email: contact?.email ?? "",
  company: contact?.company ?? "",
  status: contact?.status ?? "Lead",
  lastContactedAt: contact?.lastContactedAt ? contact.lastContactedAt.slice(0, 10) : "",
});

const formatContactedAt = (value: string | null) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

function Contacts() {
  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null);
  const queryClient = useQueryClient();

  const contactsQuery = useQuery({
    queryKey: ["contacts", query],
    queryFn: () => contactService.listContacts(query.trim() || undefined),
  });

  const createMutation = useMutation({
    mutationFn: (payload: ContactInput) => contactService.createContact(payload),
    onSuccess: async () => {
      toast.success("Contact created.");
      setIsCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not create the contact.")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ContactInput> }) =>
      contactService.updateContact(id, payload),
    onSuccess: async () => {
      toast.success("Contact updated.");
      setEditingContact(null);
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not update the contact.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactService.deleteContact(id),
    onSuccess: async () => {
      toast.success("Contact deleted.");
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not delete the contact.")),
  });

  const filteredContacts = useMemo(
    () =>
      (contactsQuery.data ?? []).filter((contact) =>
          (contact.name + (contact.email ?? "") + (contact.company ?? ""))
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [contactsQuery.data, query],
  );

  if (contactsQuery.isLoading) {
    return (
      <AppShell title="Contacts">
        <PageLoadingState title="Loading contacts" description="Fetching contacts from the backend." />
      </AppShell>
    );
  }

  if (contactsQuery.isError) {
    return (
      <AppShell title="Contacts">
        <PageErrorState
          title="Contacts unavailable"
          description="We could not load your contacts right now."
          actionLabel="Retry"
          onAction={() => contactsQuery.refetch()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Contacts">
      <div className="mb-4 flex items-center justify-between gap-3">
        <input
          placeholder="Search contacts..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-72 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={() => setIsCreateOpen(true)}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Contact
        </button>
      </div>

      <div className="rounded border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Last Contacted</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.map((contact, index) => (
              <tr key={contact.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{contact.name}</td>
                <td className="px-4 py-2">{contact.phone}</td>
                <td className="px-4 py-2">{contact.email}</td>
                <td className="px-4 py-2">{contact.company}</td>
                <td className="px-4 py-2 text-gray-600">{formatContactedAt(contact.lastContactedAt)}</td>
                <td className="px-4 py-2">{contact.status}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingContact(contact)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete ${contact.name}?`)) {
                          void deleteMutation.mutateAsync(contact.id);
                        }
                      }}
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                  <PageEmptyState
                    title="No contacts found"
                    description={query ? "Try a different search term." : "Add your first contact to get started."}
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ContactDialog
        open={isCreateOpen}
        title="Add Contact"
        initialValue={emptyContactForm()}
        submitting={createMutation.isPending}
        onOpenChange={setIsCreateOpen}
        onSubmit={async (form) => {
          await createMutation.mutateAsync({
            name: form.name,
            phone: form.phone,
            email: form.email || undefined,
            company: form.company || undefined,
            status: form.status,
            lastContactedAt: form.lastContactedAt || undefined,
          });
        }}
      />

      <ContactDialog
        open={editingContact !== null}
        title="Edit Contact"
        initialValue={toContactForm(editingContact)}
        submitting={updateMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setEditingContact(null);
          }
        }}
        onSubmit={async (form) => {
          if (!editingContact) {
            return;
          }

          await updateMutation.mutateAsync({
            id: editingContact.id,
            payload: {
              name: form.name,
              phone: form.phone,
              email: form.email || undefined,
              company: form.company || undefined,
              status: form.status,
              lastContactedAt: form.lastContactedAt || undefined,
            },
          });
        }}
      />
    </AppShell>
  );
}

function ContactDialog({
  open,
  title,
  initialValue,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initialValue: ContactFormState;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: ContactFormState) => Promise<void>;
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
          {(["name", "phone", "email", "company", "status", "lastContactedAt"] as const).map(
            (field) => (
              <div key={field}>
                <label className="block text-xs text-gray-600 capitalize">{field}</label>
                <input
                  required={field === "name" || field === "phone" || field === "status"}
                  type={field === "lastContactedAt" ? "date" : "text"}
                  value={form[field]}
                  onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            ),
          )}
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
