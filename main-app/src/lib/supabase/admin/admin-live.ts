"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

/** Marks an agenda event live/ended. Sets status_override so the DB's
 * time-based auto_update_event_status() cron won't immediately flip it back. */
export async function setEventLive(eventId: string, live: boolean) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("event")
    .update({ status: live ? "live" : "completed", status_override: true })
    .eq("event_id", eventId);
  if (error) return { error: error.message };
  revalidatePath("/admin/live");
  return { error: null };
}

/** Opens/closes a feedback window (feedback_status: locked/live/unlocked). */
export async function setFeedbackStatus(feedbackId: string, status: "locked" | "live" | "unlocked") {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("feedback").update({ status }).eq("feedback_id", feedbackId);
  if (error) return { error: error.message };
  revalidatePath("/admin/live");
  return { error: null };
}

async function updateLiveState(fields: Record<string, string | boolean | null>) {
  const { userId } = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("live_state")
    .update({ ...fields, updated_by: userId, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { error: error.message };
  revalidatePath("/admin/live");
  return { error: null };
}

/** Gates /growth-machine itself — while false, attendees see a locked
 * screen instead of the role picker/board (see growth-machine/page.tsx). */
export async function setGrowthMachineSessionLive(live: boolean) {
  return updateLiveState({ growth_machine_session_live: live });
}

export async function startGrowthMachineTimer(label: string, durationSeconds: number) {
  const endsAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
  return updateLiveState({ growth_machine_timer_label: label, growth_machine_timer_ends_at: endsAt });
}

export async function clearGrowthMachineTimer() {
  return updateLiveState({ growth_machine_timer_label: null, growth_machine_timer_ends_at: null });
}

export async function startGeneralCountdown(label: string, durationSeconds: number) {
  const endsAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
  return updateLiveState({ general_countdown_label: label, general_countdown_ends_at: endsAt });
}

export async function clearGeneralCountdown() {
  return updateLiveState({ general_countdown_label: null, general_countdown_ends_at: null });
}
