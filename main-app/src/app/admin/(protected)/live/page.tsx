import { createClient } from "@/lib/supabase/server";
import { LiveControlClient } from "./live-control-client";

export default async function LiveControlPage() {
  const supabase = await createClient();

  const [{ data: events }, { data: feedback }, { data: liveState }] = await Promise.all([
    supabase.from("event").select("event_id, event_name, status").order("start_time"),
    supabase.from("feedback").select("feedback_id, feedback_name, status"),
    supabase.from("live_state").select("*").eq("id", true).single(),
  ]);

  return (
    <LiveControlClient
      initialEvents={events ?? []}
      initialFeedback={feedback ?? []}
      initialLiveState={liveState}
    />
  );
}
