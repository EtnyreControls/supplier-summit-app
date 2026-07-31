"""One-off seed for the REAL Supplier Summit agenda (not test data).

Inserts the 13 agenda slots from the provided schedule as public.event rows,
and a public.user + public.speakers row for each of the 7 sessions with a
named role (e.g. "VP Supply Chain") — no email/pin set, so these accounts
have no login yet; that comes later when a real person is assigned to the
role. Bios are short, derived only from the session's own title/context (no
invented facts about real people) so nlp-service has something to embed for
ML routing.

Dates are a PLACEHOLDER (2026-08-13) — update event.start_time/end_time
once the real summit date is confirmed. Two agenda rows have no role listed
in the source schedule and are intentionally left speaker-less:
  - 11:00-12:00 "Speaker -Wining through Strategic Partnership"
  - 2:30-3:00 "Vice of Supplier: Partnership Priorities & Live dialogue"

Safe to re-run: skipped if a session with the same topic already exists.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

DATE = "2026-08-13"  # placeholder — correct once the real date is known


def t(hhmm: str) -> str:
    return f"{DATE}T{hhmm}:00Z"


# (start, end, topic/title, description, duration, role_name_or_None, bio_or_None)
SESSIONS = [
    (
        "08:00", "08:30",
        "Registration, Breakfast, Networking & Supplier Connection Challenge (Icebreaker)",
        "Registration, breakfast, and a networking icebreaker: the Supplier Connection Challenge.",
        "30 min",
        "Procurement Team",
        "Leads registration, breakfast logistics, and the Supplier Connection Challenge icebreaker to open the summit.",
    ),
    (
        "08:30", "08:45",
        "Welcome, Safety Message & Summit Objectives",
        "Welcome remarks, a safety message, and an overview of the summit's objectives.",
        "15 min",
        "VP Supply Chain",
        "Oversees supply chain strategy; opens the summit with welcome remarks, the safety message, and summit objectives, and returns to deliver closing remarks.",
    ),
    (
        "08:45", "09:15",
        "Executive Business Update: Etnyre's 7-Year Growth Strategy",
        "An executive update on Etnyre's 7-year growth strategy.",
        "30 min",
        "President & CEO",
        "Etnyre's President & CEO, presenting the executive business update and the company's 7-year growth strategy.",
    ),
    (
        "09:15", "10:15",
        "Business Unit Gallery Walk",
        "A gallery walk across Etnyre's business units.",
        "1 hr",
        "Business Unit Leaders/Buyers",
        "Business unit leaders and buyers hosting the gallery walk across Etnyre's product lines and business units.",
    ),
    ("10:15", "10:30", "Break", "Break.", "15 min", None, None),
    (
        "10:30", "11:00",
        "Global Growth & Strategic Sourcing",
        "A session on global growth and strategic sourcing.",
        "30 min",
        "Director of Strategic Sourcing/SDM",
        "Director of Strategic Sourcing, focused on global growth strategy and strategic sourcing initiatives.",
    ),
    (
        "11:00", "12:00",
        "Speaker -Wining through Strategic Partnership",
        "A session on winning through strategic partnership.",
        "1 hr",
        None,  # no role listed in the source schedule
        None,
    ),
    ("12:00", "12:45", "Lunch & Networking", "Lunch and networking.", "45 min", None, None),
    (
        "12:45", "13:45",
        "Growth Machine - Interactive Workshop",
        "An interactive Growth Machine workshop.",
        "1 hr",
        "Procurement Leadership",
        "Procurement leadership guiding the Growth Machine interactive workshop.",
    ),
    (
        "13:45", "14:15",
        "Team Presentations and Feedback",
        "Team presentations and feedback from the day's workshops.",
        "30 min",
        "Supplier Teams",
        "Supplier teams presenting team updates and feedback from summit workshops.",
    ),
    ("14:15", "14:30", "Break", "Break.", "15 min", None, None),
    (
        "14:30", "15:00",
        "Vice of Supplier: Partnership Priorities & Live dialogue",
        "A live dialogue on supplier partnership priorities.",
        "30 min",
        None,  # no role listed in the source schedule
        None,
    ),
    (
        "15:00", "15:30",
        "Closing Remarks, Partnership Commitments & Next Steps",
        "Closing remarks, partnership commitments, and next steps.",
        "30 min",
        "VP Supply Chain",
        None,  # same role/person as the opening session — reuses that speaker below
    ),
]


def get_or_create_role_user(role_name: str) -> str:
    existing = sb.table("user").select("user_id").eq("first_name", role_name).eq("role", "speaker").execute()
    if existing.data:
        return existing.data[0]["user_id"]
    resp = sb.table("user").insert({"first_name": role_name, "role": "speaker"}).execute()
    return resp.data[0]["user_id"]


def main() -> None:
    role_user_ids: dict[str, str] = {}

    for start, end, topic, description, duration, role, bio in SESSIONS:
        # topic alone isn't unique (both breaks are titled "Break") — pair
        # it with start_time so re-running this script is actually idempotent.
        existing_event = sb.table("event").select("event_id").eq("topic", topic).eq("start_time", t(start)).execute()
        if existing_event.data:
            event_id = existing_event.data[0]["event_id"]
            print(f"  event exists, skipping insert: {topic}")
        else:
            event_resp = sb.table("event").insert(
                {
                    # event_name is unused for display (see agenda/page.tsx's
                    # fix) but is a not-null timestamptz column — start_time
                    # is as good a value as any.
                    "event_name": t(start),
                    "duration": duration,
                    "topic": topic,
                    "description": description,
                    "start_time": t(start),
                    "end_time": t(end),
                }
            ).execute()
            event_id = event_resp.data[0]["event_id"]
            print(f"  event created: {topic} ({start}-{end})")

        if role is None:
            continue

        if role not in role_user_ids:
            role_user_ids[role] = get_or_create_role_user(role)
        user_id = role_user_ids[role]

        existing_speaker = (
            sb.table("speakers").select("speaker_id").eq("user_id", user_id).eq("event_id", event_id).execute()
        )
        if existing_speaker.data:
            print(f"    speaker link exists: {role} -> {topic}")
            continue

        # Reuse this role's own bio if given, else fall back to whatever bio
        # was set the first time this role appeared (e.g. VP Supply Chain's
        # closing-remarks row reuses the bio written on their opening row).
        speaker_bio = bio
        if speaker_bio is None:
            prior = sb.table("speakers").select("bio").eq("user_id", user_id).limit(1).execute()
            speaker_bio = prior.data[0]["bio"] if prior.data else None

        sb.table("speakers").insert({"user_id": user_id, "event_id": event_id, "bio": speaker_bio}).execute()
        print(f"    speaker linked: {role} -> {topic}")


if __name__ == "__main__":
    main()
