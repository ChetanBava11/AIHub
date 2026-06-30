import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";

export const Route = createFileRoute("/contacts")({
  head: () => ({ meta: [{ title: "Contacts — OpsCRM" }] }),
  component: Contacts,
});

type Contact = {
  name: string;
  phone: string;
  email: string;
  company: string;
  lastContacted: string;
  status: string;
};

const seed: Contact[] = [
  { name: "Jane Doe", phone: "+1 555-2310", email: "jane@globex.com", company: "Globex", lastContacted: "2 days ago", status: "Active" },
  { name: "Michael Smith", phone: "+1 555-7781", email: "mike@initech.com", company: "Initech", lastContacted: "Yesterday", status: "Active" },
  { name: "Sarah Lee", phone: "+1 555-9921", email: "sarah@acme.com", company: "Acme Co.", lastContacted: "Today", status: "Lead" },
  { name: "Raj Patel", phone: "+91 98100 22112", email: "raj@umbrella.io", company: "Umbrella", lastContacted: "1 week ago", status: "Inactive" },
];

function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>(seed);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () =>
      contacts.filter((c) =>
        (c.name + c.email + c.company).toLowerCase().includes(q.toLowerCase()),
      ),
    [contacts, q],
  );

  return (
    <AppShell title="Contacts">
      <div className="mb-4 flex items-center justify-between gap-3">
        <input
          placeholder="Search contacts..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-72 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={() => setOpen(true)}
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
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2">{c.phone}</td>
                <td className="px-4 py-2">{c.email}</td>
                <td className="px-4 py-2">{c.company}</td>
                <td className="px-4 py-2 text-gray-600">{c.lastContacted}</td>
                <td className="px-4 py-2">{c.status}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No contacts match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <AddContactModal
          onClose={() => setOpen(false)}
          onAdd={(c) => {
            setContacts((prev) => [c, ...prev]);
            setOpen(false);
          }}
        />
      )}
    </AppShell>
  );
}

function AddContactModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (c: Contact) => void;
}) {
  const [form, setForm] = useState<Contact>({
    name: "",
    phone: "",
    email: "",
    company: "",
    lastContacted: "Today",
    status: "Lead",
  });
  const set = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(form);
        }}
        className="w-full max-w-md rounded border border-gray-200 bg-white p-5"
      >
        <h2 className="mb-3 text-base font-semibold">Add Contact</h2>
        <div className="space-y-2">
          {(["name", "phone", "email", "company"] as const).map((f) => (
            <div key={f}>
              <label className="block text-xs text-gray-600 capitalize">{f}</label>
              <input
                required={f === "name"}
                value={form[f]}
                onChange={set(f)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}