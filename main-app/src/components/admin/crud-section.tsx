"use client";
import * as React from "react";
import { DataTable, type DataTableColumn } from "./data-table";
import { EntityFormDialog, type EntityField } from "./entity-form-dialog";
import { useToast } from "../feedback";

/**
 * One CRUD entity — a DataTable plus its create/edit dialog, wired to
 * server actions. Shared by every /admin/* entity screen so each screen
 * only has to describe its columns/fields, not rebuild this wiring.
 */
export function CrudSection<T extends Record<string, unknown>>({
  title,
  idKey,
  rows,
  setRows,
  columns,
  fields,
  onCreate,
  onUpdate,
  onDelete,
  allowCreate = true,
}: {
  title: string;
  idKey: keyof T & string;
  rows: T[];
  setRows: React.Dispatch<React.SetStateAction<T[]>>;
  columns: DataTableColumn<T & { id: string }>[];
  fields: EntityField[];
  onCreate?: (values: Partial<T>) => Promise<{ data?: Record<string, unknown> | null; error: string | null }>;
  onUpdate: (id: string, values: Partial<T>) => Promise<{ error: string | null }>;
  onDelete: (id: string) => Promise<{ error: string | null }>;
  allowCreate?: boolean;
}) {
  const { toast, showToast } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<T | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const emptyValues = Object.fromEntries(fields.map((f) => [f.name, f.type === "checkbox" ? false : ""]));

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    let result: { data?: Record<string, unknown> | null; error: string | null };
    try {
      result = editing
        ? await onUpdate(String(editing[idKey]), values as Partial<T>)
        : onCreate
          ? await onCreate(values as Partial<T>)
          : { error: "Create isn't supported for this entity" };
    } catch {
      // A rejected/thrown action (e.g. a stale Server Action ID after a
      // rebuild — see Next's server-actions docs) used to leave
      // `submitting` stuck true forever with no feedback, reading as the
      // dialog silently "buffering." Surface it and let the button reset
      // instead of hanging.
      setSubmitting(false);
      showToast("Save failed — please refresh the page and try again.", "error");
      return;
    }
    setSubmitting(false);
    if (result.error) {
      showToast(result.error, "error");
      return;
    }
    if (editing) {
      setRows((prev) => prev.map((r) => (r[idKey] === editing[idKey] ? { ...r, ...values } : r)));
    } else {
      // Prefer the real inserted row crudCreate now selects back; only fall
      // back to a client-guessed id in the (unexpected) case a create action
      // returns success with no row — better than crashing on a missing key.
      const created = (result.data as T | undefined) ?? ({ ...values, [idKey]: crypto.randomUUID() } as T);
      setRows((prev) => [...prev, created]);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const handleDelete = async (row: T) => {
    const result = await onDelete(String(row[idKey]));
    if (result.error) {
      showToast(result.error, "error");
      return;
    }
    setRows((prev) => prev.filter((r) => r[idKey] !== row[idKey]));
  };

  return (
    <div>
      <DataTable
        title={title}
        columns={columns}
        rows={rows.map((r) => ({ ...r, id: String(r[idKey]) }))}
        onAdd={allowCreate && onCreate ? () => (setEditing(null), setDialogOpen(true)) : undefined}
        onEdit={(row) => {
          setEditing(rows.find((r) => String(r[idKey]) === row.id) ?? null);
          setDialogOpen(true);
        }}
        onDelete={(row) => handleDelete(rows.find((r) => String(r[idKey]) === row.id)!)}
      />
      <EntityFormDialog
        open={dialogOpen}
        title={editing ? `Edit ${title.replace(/s$/, "")}` : `Add ${title.replace(/s$/, "")}`}
        fields={fields}
        initialValues={editing ? (editing as Record<string, unknown>) : emptyValues}
        submitting={submitting}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />
      {toast}
    </div>
  );
}
