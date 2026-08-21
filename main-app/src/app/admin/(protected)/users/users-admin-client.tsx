"use client";
import * as React from "react";
import Button from "@mui/material/Button";
import { CrudSection, EmptyState, useToast, type EntityField, type DataTableColumn } from "@/components";
import {
  createUser,
  updateUser,
  deleteUser,
  unlockUser,
  resetUserPin,
  type AdminUser,
} from "@/lib/supabase/admin/admin-users";

type UserRow = AdminUser & { id: string };

/** "Reset PIN" puts the account back to the shared placeholder
 * (EtnyreSummit2026) and forces a change on next login — same recovery
 * lever whether it's rendered inline in the main table or in the locked-
 * accounts panel below, so both share this one button. */
function ResetPinButton({ userId, onReset }: { userId: string; onReset: () => void }) {
  const { toast, showToast } = useToast();
  const [busy, setBusy] = React.useState(false);

  const handleClick = async () => {
    if (!window.confirm("Reset this account's PIN to EtnyreSummit2026? They'll be required to set a new one on next login.")) {
      return;
    }
    setBusy(true);
    const { error } = await resetUserPin(userId);
    setBusy(false);
    if (error) {
      showToast(error, "error");
      return;
    }
    onReset();
  };

  return (
    <>
      <Button size="small" variant="outlined" color="secondary" disabled={busy} onClick={handleClick}>
        Reset PIN
      </Button>
      {toast}
    </>
  );
}

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

/**
 * Recovery path for the "see an Etnyre team member" message a locked
 * attendee sees at /login — an account locks itself after 3 failed PIN
 * attempts (see 20260821190000_login_attempt_lockout.sql) and stays locked
 * until unlocked here, even with the correct PIN.
 */
function LockedAccounts({
  users,
  onUnlock,
  onReset,
}: {
  users: AdminUser[];
  onUnlock: (userId: string) => void;
  onReset: (userId: string) => void;
}) {
  const { toast, showToast } = useToast();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const locked = users.filter((u) => u.locked_at);

  const handleUnlock = async (u: AdminUser) => {
    setBusyId(u.user_id);
    const { error } = await unlockUser(u.user_id);
    setBusyId(null);
    if (error) {
      showToast(error, "error");
      return;
    }
    onUnlock(u.user_id);
  };

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-ink">Locked accounts</h2>
      <p className="mt-1 text-sm text-grey-600">
        Locked after 3 failed PIN attempts — Unlock clears the lock without changing their PIN; Reset PIN also
        puts them back on EtnyreSummit2026 for when they&apos;ve forgotten it entirely.
      </p>
      <div className="mt-3">
        {locked.length === 0 ? (
          <EmptyState title="No locked accounts" body="Accounts locked out after 3 failed attempts show up here." />
        ) : (
          <div className="flex flex-col gap-2">
            {locked.map((u) => (
              <div
                key={u.user_id}
                className="flex items-center justify-between gap-3 rounded-(--radius-card) border border-grey-200 bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "Unnamed"}
                  </p>
                  <p className="truncate text-xs text-grey-500">{u.email ?? "No email on file"}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    disabled={busyId === u.user_id}
                    onClick={() => handleUnlock(u)}
                  >
                    Unlock
                  </Button>
                  <ResetPinButton userId={u.user_id} onReset={() => onReset(u.user_id)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {toast}
    </div>
  );
}

export function UsersAdminClient({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [users, setUsers] = React.useState(initialUsers);

  const applyReset = (userId: string) =>
    setUsers((prev) =>
      prev.map((u) =>
        u.user_id === userId ? { ...u, locked_at: null, failed_login_attempts: 0 } : u,
      ),
    );

  const columns: DataTableColumn<UserRow>[] = [
    { key: "first_name", label: "First name" },
    { key: "last_name", label: "Last name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role" },
    {
      key: "pin",
      label: "PIN",
      render: (row) => <ResetPinButton userId={row.user_id} onReset={() => applyReset(row.user_id)} />,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Users</h1>
      <p className="mt-1 text-sm text-grey-600">
        Role changes are the main lever here — a user can never change their own role (DB-enforced).
      </p>
      <LockedAccounts users={users} onUnlock={applyReset} onReset={applyReset} />
      <div className="mt-10">
        <CrudSection
          title="Users"
          idKey="user_id"
          rows={users}
          setRows={setUsers}
          columns={columns}
          fields={USER_FIELDS}
          onCreate={createUser}
          onUpdate={updateUser}
          onDelete={deleteUser}
        />
      </div>
    </div>
  );
}
