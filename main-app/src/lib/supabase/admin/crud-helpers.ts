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

export async function crudCreate(table: string, values: Record<string, unknown>): Promise<{ error: string | null }> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from(table).insert(values);
  return { error: error?.message ?? null };
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
