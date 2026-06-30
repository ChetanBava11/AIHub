import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";

export const Route = createFileRoute("/contacts")({
  head: () => ({ meta: [{ title: "Contacts | AIHub" }] }),
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

const seedContacts: Contact[] = [
  {
    name: "Jane Doe",
    phone: "+1 555-2310",
    email: "jane@globex.com",
    company: "Globex",
    lastContacted: "2 days ago",
    status: "Active",
  },
  {
    name: "Michael Smith",
    phone: "+1 555-7781",
    email: "mike@initech.com",
    company: "Initech",
    lastContacted: "Yesterday",
    status: "Active",
  },
  {
    name: "Sarah Lee",
    phone: "+1 555-9921",
    email: "sarah@acme.com",
    company: "Acme Co.",
    lastContacted: "Today",
    status: "Lead",
  },
  {
    name: "Raj Patel",
    phone: "+91 98100 22112",
    email: "raj@umbrella.io",
    company: "Umbrella",
    lastContacted: "1 week ago",
    status: "Inactive",
  },
];

function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>(seedContacts);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filteredContacts = useMemo(
    () =>
      contacts.filter((contact) =>
        (contact.name + contact.email + contact.company)
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [contacts, query],
  );

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
            {filteredContacts.map((contact, index) => (
              <tr key={index} className="border-t border-gray-100">
                <td className="px-4 py-2">{contact.name}</td>
                <td className="px-4 py-2">{contact.phone}</td>
                <td className="px-4 py-2">{contact.email}</td>
                <td className="px-4 py-2">{contact.company}</td>
                <td className="px-4 py-2 text-gray-600">{contact.lastContacted}</td>
                <td className="px-4 py-2">{contact.status}</td>
              </tr>
            ))}
            {filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No contacts match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {open ? (
        <AddContactModal
          onClose={() => setOpen(false)}
          onAdd={(contact) => {
            setContacts((current) => [contact, ...current]);
            setOpen(false);
          }}
        />
      ) : null}
    </AppShell>
  );
}

function AddContactModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (contact: Contact) => void;
}) {
  const [form, setForm] = useState<Contact>({
    name: "",
    phone: "",
    email: "",
    company: "",
    lastContacted: "Today",
    status: "Lead",
  });

  const setField = (key: keyof Contact) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: event.target.value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onAdd(form);
        }}
        className="w-full max-w-md rounded border border-gray-200 bg-white p-5"
      >
        <h2 className="mb-3 text-base font-semibold">Add Contact</h2>
        <div className="space-y-2">
          {(["name", "phone", "email", "company"] as const).map((field) => (
            <div key={field}>
              <label className="block text-xs text-gray-600 capitalize">{field}</label>
              <input
                required={field === "name"}
                value={form[field]}
                onChange={setField(field)}
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
