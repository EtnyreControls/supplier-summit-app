import { createClient } from "@/lib/supabase/server";
import { AgendaPageClient } from "./agenda-page-client";
import type { AgendaSession, AgendaSpeaker } from "@/components";

/**
 * Route: /agenda ("Agenda & speakers" in TopNav)
 * Server Component: reads event + speakers straight from Supabase (RLS
 * requires an authenticated session — signed-out visitors see the empty
 * state in AgendaPageClient until login is wired up).
 */

type EventRow = {
  event_id: string;
  event_name: string;
  description: string | null;
  status: string;
  start_time: string | null;
  end_time: string | null;
};

type SpeakerRow = {
  speaker_id: string;
  event_id: string | null;
  bio: string | null;
  user_id: string | null;
};

type SpeakerInfoRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
};

function formatTimeRange(start: string | null, end: string | null) {
  if (!start) return "";
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
      new Date(iso),
    );
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function AgendaPage() {
  const supabase = await createClient();

  const [{ data: events }, { data: speakerRows }, { data: speakerInfoData }] = await Promise.all([
    supabase
      .from("event")
      .select("event_id, event_name, description, status, start_time, end_time")
      .order("start_time", { ascending: true })
      .returns<EventRow[]>(),
    supabase.from("speakers").select("speaker_id, event_id, bio, user_id").returns<SpeakerRow[]>(),
    // "user" RLS has no policy letting an attendee see another user's name
    // directly (only own-row / admin) — speaker_public_info() is a narrow
    // SECURITY DEFINER function that exposes just first_name/last_name/
    // company for users who are actually speakers, same pattern as
    // is_admin()/verify_pin() elsewhere in this schema.
    supabase.rpc("speaker_public_info"),
  ]);
  const speakerInfoRows = (speakerInfoData ?? []) as SpeakerInfoRow[];

  const infoByUserId = new Map(speakerInfoRows.map((r) => [r.user_id, r]));

  const speakerByUser = new Map<string, AgendaSpeaker>();
  const speakerIdsByEvent = new Map<string, string[]>();

  for (const row of speakerRows ?? []) {
    const person = row.user_id ? infoByUserId.get(row.user_id) : undefined;
    if (!person || !row.event_id) continue;

    const name = [person.first_name, person.last_name].filter(Boolean).join(" ") || "Speaker";
    if (!speakerByUser.has(person.user_id)) {
      speakerByUser.set(person.user_id, {
        id: person.user_id,
        name,
        role: person.company ?? "",
        initials: initialsOf(name),
        bio: row.bio ?? undefined,
      });
    }

    const ids = speakerIdsByEvent.get(row.event_id) ?? [];
    ids.push(person.user_id);
    speakerIdsByEvent.set(row.event_id, ids);
  }

  const sessions: AgendaSession[] = (events ?? []).map((e) => ({
    id: e.event_id,
    // event_name now holds the session title (schema has drifted from the
    // original timestamptz definition in init_schema.sql). topic is reserved
    // for the NLP question-routing system, not display. There's no real
    // venue/room data in this dataset, so location is left blank.
    title: e.event_name ?? "",
    time: formatTimeRange(e.start_time, e.end_time),
    location: "",
    description: e.description ?? "",
    live: e.status === "live",
    speakerIds: speakerIdsByEvent.get(e.event_id) ?? [],
  }));

  const speakers = [...speakerByUser.values()];

  return <AgendaPageClient sessions={sessions} speakers={speakers} />;
}
