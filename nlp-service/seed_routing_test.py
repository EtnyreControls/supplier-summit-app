"""One-off seed + exercise script for the speaker question-routing feature.

Creates clearly-labeled test fixtures (SUMMIT-TEST-* badge IDs, @example.com
emails) — 5 speakers with distinct-topic bios, 1 test attendee, and 7 test
questions — then drives them through the real /api/questions/route endpoint
(the same one submit-question.ts calls) to exercise routing, decline,
re-route, never-repeats, and exhaustion-to-unrouted.

Not part of the app itself — a throwaway verification script, safe to
delete once the manual walkthrough is done.
"""

from __future__ import annotations

import os
import sys
import time

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

NLP_URL = "http://localhost:8080"

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

SPEAKERS = [
    {
        "first_name": "Dana",
        "last_name": "Ruiz",
        "email": "test.speaker.logistics@example.com",
        "unique_id": "SUMMIT-TEST-SPK-1",
        "bio": "Dana leads freight and logistics operations, specializing in route "
        "optimization, carrier contracts, and last-mile delivery for supplier networks.",
    },
    {
        "first_name": "Marcus",
        "last_name": "Chen",
        "email": "test.speaker.fleet@example.com",
        "unique_id": "SUMMIT-TEST-SPK-2",
        "bio": "Marcus is a fleet maintenance engineer focused on preventive maintenance "
        "schedules, diesel engine diagnostics, and extending vehicle service life.",
    },
    {
        "first_name": "Priya",
        "last_name": "Nair",
        "email": "test.speaker.safety@example.com",
        "unique_id": "SUMMIT-TEST-SPK-3",
        "bio": "Priya oversees safety compliance programs, OSHA audits, driver "
        "certification, and incident reporting across the supplier network.",
    },
    {
        "first_name": "Owen",
        "last_name": "Bright",
        "email": "test.speaker.procurement@example.com",
        "unique_id": "SUMMIT-TEST-SPK-4",
        "bio": "Owen builds procurement software and e-sourcing platforms, covering "
        "supplier onboarding, purchase order automation, and spend analytics tools.",
    },
    {
        "first_name": "Yara",
        "last_name": "Haddad",
        "email": "test.speaker.quality@example.com",
        "unique_id": "SUMMIT-TEST-SPK-5",
        "bio": "Yara manages supplier quality assurance, contract negotiation, and "
        "vendor scorecards to keep supplier performance aligned with contract terms.",
    },
]

ATTENDEE = {
    "first_name": "Test",
    "last_name": "Attendee",
    "email": "test.attendee.routing@example.com",
    "unique_id": "SUMMIT-TEST-ATT-1",
}

# (label, text) — label is just for readable output, not stored.
QUESTIONS = [
    ("logistics", "What's the best way to optimize delivery routes across multiple regional carriers?"),
    ("fleet", "How often should we schedule preventive maintenance on our diesel delivery trucks?"),
    ("safety", "What OSHA certifications do our drivers need for interstate hauling?"),
    ("procurement", "Can your e-sourcing platform automate purchase order approvals?"),
    ("quality-1", "What's a fair contract renegotiation clause for underperforming suppliers?"),
    ("quality-2 (decline test)", "Is there a recommended cadence for reviewing vendor scorecards?"),
    ("exhaustion test", "asdf random unrelated gibberish question xyz 12345"),
]

TEST_PIN = "1234"


def create_login(first_name: str, last_name: str, email: str, unique_id: str, role: str) -> str:
    """Creates a matching auth.users + public.user row, returns user_id."""
    existing = sb.table("user").select("user_id").eq("unique_id", unique_id).execute()
    if existing.data:
        return existing.data[0]["user_id"]

    auth_resp = sb.auth.admin.create_user({"email": email, "email_confirm": True})
    user_id = auth_resp.user.id

    sb.table("user").insert(
        {
            "user_id": user_id,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "role": role,
            "unique_id": unique_id,
            "pin": TEST_PIN,
        }
    ).execute()
    return user_id


def seed_speakers() -> list[dict]:
    speaker_rows = []
    for s in SPEAKERS:
        user_id = create_login(s["first_name"], s["last_name"], s["email"], s["unique_id"], "speaker")

        existing = sb.table("speakers").select("speaker_id").eq("user_id", user_id).execute()
        if existing.data:
            speaker_id = existing.data[0]["speaker_id"]
        else:
            resp = sb.table("speakers").insert({"user_id": user_id, "bio": s["bio"]}).execute()
            speaker_id = resp.data[0]["speaker_id"]

        speaker_rows.append({**s, "user_id": user_id, "speaker_id": speaker_id})
        print(f"  speaker ready: {s['first_name']} {s['last_name']} ({speaker_id})")
    return speaker_rows


def seed_attendee() -> str:
    user_id = create_login(
        ATTENDEE["first_name"], ATTENDEE["last_name"], ATTENDEE["email"], ATTENDEE["unique_id"], "attendee"
    )
    print(f"  attendee ready: {ATTENDEE['first_name']} {ATTENDEE['last_name']} ({user_id})")
    return user_id


def insert_question(submitter_id: str, text: str) -> str:
    """Mirrors what submit_question() does, minus the auth.uid() check (this
    runs as service role), so the resulting rows are indistinguishable from a
    real submission for routing purposes."""
    group_resp = sb.table("question_groups").insert(
        {"topic": "General", "composed_question": text, "status": "pending", "checked": False}
    ).execute()
    group_id = group_resp.data[0]["group_id"]

    question_resp = sb.table("questions").insert(
        {
            "topic": "General",
            "submission_info": text,
            "submitter_id": submitter_id,
            "group_id": group_id,
            "status": "pending",
            "checked": False,
            "is_anonymous": False,
        }
    ).execute()
    return question_resp.data[0]["question_id"]


def route(question_id: str, text: str) -> dict:
    resp = requests.post(f"{NLP_URL}/api/questions/route", json={"question_id": question_id, "question_text": text})
    resp.raise_for_status()
    return resp.json()


def decline_latest_pending(question_id: str) -> dict:
    resp = (
        sb.table("question_routing")
        .select("routing_id, speaker_id")
        .eq("question_id", question_id)
        .eq("status", "pending")
        .single()
        .execute()
    )
    row = resp.data
    sb.table("question_routing").update({"status": "declined", "decided_at": "now()"}).eq(
        "routing_id", row["routing_id"]
    ).execute()
    return row


def speaker_name_by_id(speaker_rows: list[dict], speaker_id: str | None) -> str:
    if speaker_id is None:
        return "(none)"
    for s in speaker_rows:
        if s["speaker_id"] == speaker_id:
            return f"{s['first_name']} {s['last_name']}"
    return speaker_id


def main() -> None:
    print("== 1. Seeding speakers ==")
    speaker_rows = seed_speakers()

    print("\n== 2. Seeding test attendee ==")
    attendee_id = seed_attendee()

    print("\n== 3. Analytics count BEFORE test questions ==")
    before = sb.table("question_groups").select("group_id", count="exact").execute()
    print(f"  question_groups count: {before.count}")

    print("\n== 4. Submitting + routing test questions ==")
    question_ids: dict[str, str] = {}
    for label, text in QUESTIONS:
        qid = insert_question(attendee_id, text)
        question_ids[label] = qid
        result = route(qid, text)
        speaker = speaker_name_by_id(speaker_rows, result.get("speaker_id"))
        print(f"  [{label}] -> {result['status']} -> {speaker} (score={result.get('similarity_score')})")
        time.sleep(0.2)

    after_submit = sb.table("question_groups").select("group_id", count="exact").execute()
    print(f"\n  question_groups count right after submitting all test questions: {after_submit.count}")

    print("\n== 5. Decline test: 'quality-2' should NOT repeat Yara ==")
    qid = question_ids["quality-2 (decline test)"]
    declined = decline_latest_pending(qid)
    print(f"  declined speaker: {speaker_name_by_id(speaker_rows, declined['speaker_id'])}")
    result = route(qid, dict(QUESTIONS)["quality-2 (decline test)"])
    new_speaker = speaker_name_by_id(speaker_rows, result.get("speaker_id"))
    print(f"  re-routed -> {result['status']} -> {new_speaker}")
    assert result.get("speaker_id") != declined["speaker_id"], "re-routed to the same speaker!"

    print("\n== 6. Exhaustion test: decline through every speaker for 'exhaustion test' ==")
    qid = question_ids["exhaustion test"]
    text = dict(QUESTIONS)["exhaustion test"]
    seen_speakers = set()
    for attempt in range(len(SPEAKERS) + 2):
        rows = sb.table("question_routing").select("speaker_id, status").eq("question_id", qid).execute().data
        latest_pending = [r for r in rows if r["status"] == "pending"]
        if not latest_pending:
            unrouted = [r for r in rows if r["status"] == "unrouted"]
            print(f"  reached terminal state after {attempt} declines: unrouted={bool(unrouted)}")
            assert unrouted, "expected an unrouted row once every speaker is exhausted"
            break
        speaker_id = latest_pending[0]["speaker_id"]
        assert speaker_id not in seen_speakers, f"speaker {speaker_id} routed to twice!"
        seen_speakers.add(speaker_id)
        decline_latest_pending(qid)
        result = route(qid, text)
        print(f"  decline #{attempt + 1} ({speaker_name_by_id(speaker_rows, speaker_id)}) -> {result['status']}")

    print("\n== 7. Full audit trail for the exhaustion-test question ==")
    audit = (
        sb.table("question_routing")
        .select("attempt_number, speaker_id, status, similarity_score")
        .eq("question_id", qid)
        .order("attempt_number")
        .execute()
        .data
    )
    for row in audit:
        print(
            f"  attempt {row['attempt_number']}: {speaker_name_by_id(speaker_rows, row['speaker_id'])} "
            f"-> {row['status']} (score={row['similarity_score']})"
        )

    print("\n== 8. Analytics count AFTER all routing/decline activity ==")
    after = sb.table("question_groups").select("group_id", count="exact").execute()
    print(f"  question_groups count: {after.count}")
    print(f"  baseline before any test questions: {before.count}")
    print(f"  right after submitting {len(QUESTIONS)} test questions: {after_submit.count}")
    print(f"  after all decline/re-route activity: {after.count}")
    assert after.count == after_submit.count, (
        "question_groups row count changed during decline/re-route — routing must never touch questions/question_groups!"
    )
    print("  PASS: decline/re-route activity did not change the question_groups row count.")

    print("\nDone.")


if __name__ == "__main__":
    main()
