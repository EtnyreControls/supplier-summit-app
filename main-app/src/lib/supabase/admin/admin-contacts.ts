"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

const PATH = "/admin/contacts";

export type AdminContact = {
  owner_id: string;
  contact_user_id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  saved_at: string;
};

// contacts has a composite primary key (owner_id, contact_user_id) — read
// and delete only, since a saved contact is a snapshot of an exchange, not
// something meant to be hand-edited.
export async function listContacts() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.from("contacts").select("*").order("saved_at", { ascending: false });
  return { data: (data ?? []) as AdminContact[], error: error?.message ?? null };
}

export async function deleteContact(ownerId: string, contactUserId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("contacts")
    .delete()
    .eq("owner_id", ownerId)
    .eq("contact_user_id", contactUserId);
  if (!error) revalidatePath(PATH);
  return { error: error?.message ?? null };
}
