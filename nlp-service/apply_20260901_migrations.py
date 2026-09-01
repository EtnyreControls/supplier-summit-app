"""Applies 20260901120000_add_justin_to_table_12.sql and
20260901130000_seed_best_table_poll.sql via the Supabase REST client (no
direct SQL execution available through supabase-py), mirroring exactly what
those migration files do.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

GM_EVENT_ID = "6cbf1179-d7b3-4157-a16a-71945768de09"
JUSTIN_USER_ID = "865f8eb5-b350-4e2a-b993-c3b1f06eddda"
TABLE_12_ID = "125f9908-77a1-4d63-acbf-a7588a3fa6ad"


def seat_justin() -> None:
    gm_table_ids = [
        t["table_id"] for t in sb.table("event_tables").select("table_id").eq("event_id", GM_EVENT_ID).execute().data
    ]
    sb.table("event_table_members").delete().eq("user_id", JUSTIN_USER_ID).in_("table_id", gm_table_ids).execute()

    existing = (
        sb.table("event_table_members")
        .select("table_id")
        .eq("user_id", JUSTIN_USER_ID)
        .eq("table_id", TABLE_12_ID)
        .execute()
    )
    if existing.data:
        print("  Justin already seated at table 12")
        return
    sb.table("event_table_members").insert(
        {"table_id": TABLE_12_ID, "user_id": JUSTIN_USER_ID, "is_builder": False}
    ).execute()
    print("  Justin Nelson seated at table 12")


def seed_best_table_poll() -> None:
    existing = sb.table("feedback").select("feedback_id").eq("feedback_name", "Best Table").execute()
    if existing.data:
        print("  Best Table poll already exists, skipping")
        return

    tables = sb.table("event_tables").select("table_name").eq("event_id", GM_EVENT_ID).execute().data
    options = ",".join(sorted((t["table_name"] for t in tables), key=int))

    feedback_resp = (
        sb.table("feedback")
        .insert({"feedback_name": "Best Table", "status": "locked", "is_anonymous": False, "event_id": GM_EVENT_ID})
        .execute()
    )
    feedback_id = feedback_resp.data[0]["feedback_id"]

    sb.table("feedback_questions").insert(
        {
            "feedback_id": feedback_id,
            "question_text": "Which table impressed you the most? (not your own)",
            "question_type": "mcq",
            "options": options,
            "response_group": "poll",
        }
    ).execute()
    print(f"  Best Table poll created: feedback_id={feedback_id}, options={options}")


def main() -> None:
    seat_justin()
    seed_best_table_poll()


if __name__ == "__main__":
    main()
