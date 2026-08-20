import { createClient } from "@/lib/supabase/server";

/**
 * Admin landing page — read-only health/status snapshot. Counts use
 * head-only selects (count: "exact", head: true) so this stays cheap even
 * as tables grow.
 */
async function getSyncServerHealth() {
  const url = process.env.NEXT_PUBLIC_TLDRAW_SYNC_URL;
  if (!url) return { configured: false as const };

  try {
    const healthUrl = url.replace(/^wss?:/, url.startsWith("wss:") ? "https:" : "http:") + "/healthz";
    const res = await fetch(healthUrl, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { configured: true as const, ok: false, detail: `HTTP ${res.status}` };
    const body = await res.json();
    return { configured: true as const, ok: true, rooms: body.rooms as number };
  } catch (err) {
    return { configured: true as const, ok: false, detail: err instanceof Error ? err.message : "unreachable" };
  }
}

export default async function AdminStatusPage() {
  const supabase = await createClient();

  const [users, questions, feedbackResponses, contacts, gmEntries, liveEvents, syncHealth] = await Promise.all([
    supabase.from("user").select("*", { count: "exact", head: true }),
    supabase.from("questions").select("*", { count: "exact", head: true }),
    supabase.from("feedback_responses").select("*", { count: "exact", head: true }),
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("growth_machine_entries").select("*", { count: "exact", head: true }),
    supabase.from("event").select("event_id, topic").eq("status", "live"),
    getSyncServerHealth(),
  ]);

  const stats = [
    { label: "Users", value: users.count ?? 0 },
    { label: "Questions submitted", value: questions.count ?? 0 },
    { label: "Feedback responses", value: feedbackResponses.count ?? 0 },
    { label: "Contacts exchanged", value: contacts.count ?? 0 },
    { label: "Growth Machine entries", value: gmEntries.count ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">App health & status</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-(--radius-card) border border-grey-200 p-4">
            <p className="text-2xl font-bold text-ink">{s.value}</p>
            <p className="text-xs text-grey-600">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-ink">Currently live events</h2>
        {liveEvents.data && liveEvents.data.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {liveEvents.data.map((e) => (
              <li key={e.event_id} className="text-sm text-grey-700">
                {e.topic}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-grey-500">Nothing marked live right now.</p>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-ink">Growth Machine sync server</h2>
        {!syncHealth.configured && (
          <p className="mt-2 text-sm text-grey-500">NEXT_PUBLIC_TLDRAW_SYNC_URL not set — sync is disabled.</p>
        )}
        {syncHealth.configured && syncHealth.ok && (
          <p className="mt-2 text-sm text-green-700">Reachable — {syncHealth.rooms} active room(s).</p>
        )}
        {syncHealth.configured && !syncHealth.ok && (
          <p className="mt-2 text-sm text-amber-700">Unreachable — {syncHealth.detail}</p>
        )}
      </div>
    </div>
  );
}
