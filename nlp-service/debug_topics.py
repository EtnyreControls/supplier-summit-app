"""Standalone eyeball check for the topic-clustering + summarization pipeline.

Runs the same BERTopic/BART pipeline as app.py's /api/feedback/topics/refresh
(reading from Supabase if configured, else SAMPLE_FEEDBACK) and prints each
topic's id, item count, generated summary, and a few raw example items.

Not wired into FastAPI or Next.js — run directly:
    python nlp-service/debug_topics.py
"""

from __future__ import annotations

from app import get_supabase, run_pipeline


def main() -> None:
    supabase = get_supabase()
    topics = run_pipeline(supabase)

    if not topics:
        print("No topics produced (no feedback data available).")
        return

    for i, topic in enumerate(topics):
        print(f"Topic {i}: {topic['label']}")
        print(f"  item_count: {len(topic['items'])}")
        print(f"  summary: {topic['summary']}")
        print("  examples:")
        for _, text in topic["items"][:3]:
            print(f"    - {text}")
        print()


if __name__ == "__main__":
    main()
