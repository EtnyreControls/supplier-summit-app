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
};

// pin is never selected/exposed here — verify_pin (SECURITY DEFINER) is the
// only place it's ever read, same as attendee login.
const COLUMNS = "user_id, first_name, last_name, email, company, phone, role";

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
