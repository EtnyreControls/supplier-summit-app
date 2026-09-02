"""One-off: wipes every attendee-submitted row from production, per explicit
user request (2026-09-01). Leaves the definitions that submissions point at
untouched — feedback/feedback_questions (poll & feedback surveys), event,
speakers, user, event_tables/event_table_members — only what attendees
actually submitted is removed.

Delete order respects FKs (children before parents):
  question_routing -> questions -> question_groups
  feedback_answers -> feedback_responses
  feedback_submission_status (standalone)
  growth_machine_boards, growth_machine_entries, growth_machine_votes (standalone/each other)
  feedback_topic_items -> feedback_topics -> feedback_topic_runs
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

NIL = "00000000-0000-0000-0000-000000000000"

# (table, pk_column) in delete order.
TABLES = [
    ("question_routing", "routing_id"),
    ("questions", "question_id"),
    ("question_groups", "group_id"),
    ("feedback_answers", "feedback_answer_id"),
    ("feedback_responses", "feedback_response_id"),
    ("feedback_submission_status", "submission_status_id"),
    ("growth_machine_boards", "board_id"),
    ("growth_machine_entries", "uid"),
    ("feedback_topic_items", "item_id"),
    ("feedback_topics", "topic_id"),
    ("feedback_topic_runs", "run_id"),
]


def main() -> None:
    for table, pk in TABLES:
        before = sb.table(table).select(pk, count="exact").limit(1).execute().count
        sb.table(table).delete().neq(pk, NIL).execute()
        after = sb.table(table).select(pk, count="exact").limit(1).execute().count
        print(f"  {table}: {before} -> {after}")

    # Composite-PK table, no single pk column to filter by.
    votes_before = sb.table("growth_machine_votes").select("voter_uid", count="exact").limit(1).execute().count
    sb.table("growth_machine_votes").delete().neq("voter_uid", NIL).execute()
    votes_after = sb.table("growth_machine_votes").select("voter_uid", count="exact").limit(1).execute().count
    print(f"  growth_machine_votes: {votes_before} -> {votes_after}")


if __name__ == "__main__":
    main()
