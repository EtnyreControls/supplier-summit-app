"use server";

import { revalidatePath } from "next/cache";
import { crudCreate, crudDelete, crudListSelect, crudUpdate } from "./crud-helpers";

const PATH = "/admin/users";

export type AdminUser = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  phone: string | null;
  role: "attendee" | "speaker" | "analytics" | "admin" | null;
  locked_at: string | null;
  failed_login_attempts: number | null;
};

// pin is never selected/exposed here — verify_pin (SECURITY DEFINER) is the
// only place it's ever read, same as attendee login.
const COLUMNS =
  "user_id, first_name, last_name, email, company, phone, role, locked_at, failed_login_attempts";

export async function listUsers() {
  return crudListSelect<AdminUser>("user", COLUMNS, "last_name");
}
export async function createUser(values: Partial<AdminUser>) {
  const result = await crudCreate("user", values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function updateUser(id: string, values: Partial<AdminUser>) {
  const result = await crudUpdate("user", "user_id", id, values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function deleteUser(id: string) {
  const result = await crudDelete("user", "user_id", id);
  if (!result.error) revalidatePath(PATH);
  return result;
}

// Clears a lockout from too many failed PIN attempts (see
// 20260821190000_login_attempt_lockout.sql) — the "see an Etnyre team
// member" recovery path for a locked attendee. Leaves their PIN as-is; use
// resetUserPin below for someone who's forgotten it entirely.
export async function unlockUser(id: string) {
  const result = await crudUpdate("user", "user_id", id, { locked_at: null, failed_login_attempts: 0 });
  if (!result.error) revalidatePath(PATH);
  return result;
}

// Puts an account back to the shared placeholder PIN (matches the bulk
// reset run this session — see test.md) and re-flags must_change_pin so
// proxy.ts forces them through /change-pin again on their next login — also
// clears any lockout, since a forgotten PIN is exactly what runs someone
// into 3 failed attempts in the first place.
export async function resetUserPin(id: string) {
  const result = await crudUpdate("user", "user_id", id, {
    pin: "EtnyreSummit2026!",
    must_change_pin: true,
    locked_at: null,
    failed_login_attempts: 0,
  });
  if (!result.error) revalidatePath(PATH);
  return result;
}
