import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

/**
 * Shared bodies for the per-table admin server actions (admin-events.ts,
 * admin-users.ts, etc). Not itself a "use server" module — Next requires
 * every export of a "use server" file to be an async function, which rules
 * out a factory that returns closures, so each table gets its own thin
 * "use server" wrapper that calls these instead.
 */

export async function crudList<T>(table: string, orderBy?: string): Promise<{ data: T[]; error: string | null }> {
  await requireAdmin();
  const admin = createAdminClient();
  let query = admin.from(table).select("*");
  if (orderBy) query = query.order(orderBy);
  const { data, error } = await query;
  return { data: (data ?? []) as T[], error: error?.message ?? null };
}

/** Like crudList but with an explicit column list — use when a table has a
 * sensitive column (e.g. user.pin) that should never round-trip to the client. */
export async function crudListSelect<T>(
  table: string,
  columns: string,
  orderBy?: string,
): Promise<{ data: T[]; error: string | null }> {
  await requireAdmin();
  const admin = createAdminClient();
  let query = admin.from(table).select(columns);
  if (orderBy) query = query.order(orderBy);
  const { data, error } = await query;
  return { data: (data ?? []) as T[], error: error?.message ?? null };
}

export async function crudCreate(
  table: string,
  values: Record<string, unknown>,
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  await requireAdmin();
  const admin = createAdminClient();
  // Selects the inserted row back rather than trusting the caller's
  // `values` — the DB fills in defaulted/generated columns (the primary
  // key among them), and the client previously had no way to know the real
  // id, so it faked one with crypto.randomUUID() for the optimistic UI
  // update. That fake id didn't match any real row, so editing/deleting the
  // just-created row (without a page refresh first) silently operated on a
  // nonexistent id.
  const { data, error } = await admin.from(table).insert(values).select().single();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function crudUpdate(
  table: string,
  idColumn: string,
  id: string,
  values: Record<string, unknown>,
): Promise<{ error: string | null }> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from(table).update(values).eq(idColumn, id);
  return { error: error?.message ?? null };
}

export async function crudDelete(table: string, idColumn: string, id: string): Promise<{ error: string | null }> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from(table).delete().eq(idColumn, id);
  return { error: error?.message ?? null };
}
