"use client";
import * as React from "react";
import { createClient } from "@/lib/supabase/client";

type LiveState = { general_countdown_label: string | null; general_countdown_ends_at: string | null };

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Site-wide banner driven by live_state.general_countdown_* — set from
 * /admin/live. Subscribes to Supabase Realtime so it appears/updates for
 * every connected attendee without a page reload. The countdown itself
 * ticks client-side from the stored end-timestamp (no server-side ticking).
 */
export function GeneralCountdownBanner() {
  const [state, setState] = React.useState<LiveState | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const supabase = createClient();
    supabase
      .from("live_state")
      .select("general_countdown_label, general_countdown_ends_at")
      .eq("id", true)
      .single()
      .then(({ data }) => setState(data));

    const channel = supabase
      .channel("live-state-banner")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_state" },
        (payload) => setState(payload.new as LiveState),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  React.useEffect(() => {
    if (!state?.general_countdown_ends_at) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [state?.general_countdown_ends_at]);

  if (!state?.general_countdown_ends_at || !state.general_countdown_label) return null;

  const remainingMs = new Date(state.general_countdown_ends_at).getTime() - now;
  if (remainingMs <= 0) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-black px-4 py-2 text-sm font-medium text-white">
      <span>{state.general_countdown_label}</span>
      <span className="font-mono">{formatRemaining(remainingMs)}</span>
    </div>
  );
}
