"use client";
import * as React from "react";
import { CrudSection, type EntityField } from "@/components";
import { createUser, updateUser, deleteUser, type AdminUser } from "@/lib/supabase/admin/admin-users";

// No pin field here — pins are provisioned through the existing check-in
// pipeline (verify_pin, SECURITY DEFINER) and never round-trip through this
// screen, so editing a user here can't accidentally wipe their PIN.
const USER_FIELDS: EntityField[] = [
  { name: "first_name", label: "First name" },
  { name: "last_name", label: "Last name" },
  { name: "email", label: "Email" },
  { name: "company", label: "Company" },
  { name: "phone", label: "Phone" },
  {
    name: "role",
    label: "Role",
    type: "select",
    options: [
      { value: "attendee", label: "Attendee" },
      { value: "speaker", label: "Speaker" },
      { value: "analytics", label: "Analytics" },
      { value: "admin", label: "Admin" },
    ],
  },
];

export function UsersAdminClient({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [users, setUsers] = React.useState(initialUsers);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Users</h1>
      <p className="mt-1 text-sm text-grey-600">
        Role changes are the main lever here — a user can never change their own role (DB-enforced).
      </p>
      <div className="mt-6">
        <CrudSection
          title="Users"
          idKey="user_id"
          rows={users}
          setRows={setUsers}
          columns={[
            { key: "first_name", label: "First name" },
            { key: "last_name", label: "Last name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
          ]}
          fields={USER_FIELDS}
          onCreate={createUser}
          onUpdate={updateUser}
          onDelete={deleteUser}
        />
      </div>
    </div>
  );
}
