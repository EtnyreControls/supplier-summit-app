"use server";

import { revalidatePath } from "next/cache";
import { crudDelete, crudList } from "./crud-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

const PATH = "/admin/growth-machine";

export type AdminGmEntry = {
  uid: string;
  table_id: string | null;
  part: "engine" | "fuel" | "gears" | "brakes" | "turbo_boost";
  content: string;
  submitted_by: string | null;
};
export type AdminGmBoard = { board_id: string; table_id: string | null; submitted_by: string | null; created_at: string };
export type AdminGmVote = { voter_uid: string; event_uid: string; table_id: string | null; voted_at: string };

// entries/boards are produced by the live board flow (see text.tsx) —
// moderation here is read + delete only, no hand-authored create/edit.
export async function listGmEntries() {
  return crudList<AdminGmEntry>("growth_machine_entries", "created_at");
}
export async function deleteGmEntry(id: string) {
  const result = await crudDelete("growth_machine_entries", "uid", id);
  if (!result.error) revalidatePath(PATH);
  return result;
}

export async function listGmBoards() {
  return crudList<AdminGmBoard>("growth_machine_boards", "created_at");
}
export async function deleteGmBoard(id: string) {
  const result = await crudDelete("growth_machine_boards", "board_id", id);
  if (!result.error) revalidatePath(PATH);
  return result;
}

export async function listGmVotes() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.from("growth_machine_votes").select("*").order("voted_at", { ascending: false });
  return { data: (data ?? []) as AdminGmVote[], error: error?.message ?? null };
}
export async function deleteGmVote(voterUid: string, eventUid: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("growth_machine_votes").delete().eq("voter_uid", voterUid).eq("event_uid", eventUid);
  if (!error) revalidatePath(PATH);
  return { error: error?.message ?? null };
}
