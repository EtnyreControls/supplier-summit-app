"use client";
import * as React from "react";
import { DataTable, useToast } from "@/components";
import { deleteContact, type AdminContact } from "@/lib/supabase/admin/admin-contacts";

// contacts has a composite primary key (owner_id, contact_user_id), so it
// doesn't fit the single-id CrudSection — read + delete only via DataTable
// directly (see admin-contacts.ts for why editing isn't offered).
export function ContactsAdminClient({ initialContacts }: { initialContacts: AdminContact[] }) {
  const { toast, showToast } = useToast();
  const [contacts, setContacts] = React.useState(
    initialContacts.map((c) => ({ ...c, id: `${c.owner_id}:${c.contact_user_id}` })),
  );

  const handleDelete = async (row: (typeof contacts)[number]) => {
    const result = await deleteContact(row.owner_id, row.contact_user_id);
    if (result.error) {
      showToast(result.error, "error");
      return;
    }
    setContacts((prev) => prev.filter((c) => c.id !== row.id));
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Contacts</h1>
      <p className="mt-1 text-sm text-grey-600">
        Saved contact exchanges between attendees — a snapshot at save time, so only removal is offered here.
      </p>
      <div className="mt-6">
        <DataTable
          title="Saved contacts"
          columns={[
            { key: "first_name", label: "First name" },
            { key: "last_name", label: "Last name" },
            { key: "company", label: "Company" },
            { key: "email", label: "Email" },
          ]}
          rows={contacts}
          onDelete={handleDelete}
        />
      </div>
      {toast}
    </div>
  );
}
