"""Feedback topic clustering + summarization service.

Clusters real supplier feedback (feedback_answers.answer_value, for
text-type questions) into topics with BERTopic and generates a plain-English
summary per topic with a local BART model. Everything runs on-device — no
paid APIs, no API keys for the ML side.

Results are stored normalized (feedback_topic_runs / feedback_topics /
feedback_topic_items) rather than as one JSON blob, so a topic can drill
down to the exact feedback_answers row it came from. GET /api/feedback/topics
reads the latest run; POST /api/feedback/topics/refresh is the only path
that re-runs the pipeline.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from supabase import Client, create_client

from sample_feedback import SAMPLE_FEEDBACK

load_dotenv()
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

EMBEDDING_MODEL_NAME = "sentence-transformers/multi-qa-mpnet-base-dot-v1"
SUMMARIZATION_MODEL_NAME = "facebook/bart-large-cnn"
ANSWERS_TABLE = "feedback_answers"
RUNS_TABLE = "feedback_topic_runs"
TOPICS_TABLE = "feedback_topics"
TOPIC_ITEMS_TABLE = "feedback_topic_items"

# (feedback_answer_id, text) — id is None for sample-data fallback items,
# since there's no real row to link to.
FeedbackItem = tuple[Optional[str], str]

app = FastAPI(title="Supplier Summit NLP Service")

_embedding_model = None
_summarizer = None


class Topic(BaseModel):
    topic_id: str
    label: str
    item_count: int
    summary: str
    items: list[str]


class TopicsResponse(BaseModel):
    status: str
    cached_at: Optional[str]
    topics: list[Topic]


def get_supabase() -> Optional[Client]:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer

        _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _embedding_model


def get_summarizer():
    global _summarizer
    if _summarizer is None:
        from transformers import pipeline as hf_pipeline

        _summarizer = hf_pipeline("summarization", model=SUMMARIZATION_MODEL_NAME)
    return _summarizer


def load_feedback(supabase: Optional[Client]) -> list[FeedbackItem]:
    """Reads free-text feedback answers; falls back to sample data.

    Only feedback_questions.question_type = 'text' answers are pulled —
    mcq/rating answers are short codes/numbers, not free text worth topic
    modeling. Any Supabase error (missing table, no connection, etc.) is
    treated the same as "no data" so local development works without a
    live DB.
    """
    if supabase is not None:
        try:
            resp = (
                supabase.table(ANSWERS_TABLE)
                .select("feedback_answer_id, answer_value, feedback_questions(question_type)")
                .execute()
            )
            rows = resp.data or []
            items = [
                (row["feedback_answer_id"], row["answer_value"].strip())
                for row in rows
                if row.get("answer_value")
                and row["answer_value"].strip()
                and (row.get("feedback_questions") or {}).get("question_type") == "text"
            ]
            if items:
                return items
        except Exception as exc:  # noqa: BLE001
            print(f"[nlp-service] Supabase feedback query failed, using sample data: {exc}", file=sys.stderr)

    return [(None, text) for text in SAMPLE_FEEDBACK]


def build_topic_model(n_docs: int):
    from bertopic import BERTopic
    from hdbscan import HDBSCAN
    from umap import UMAP

    # BERTopic's defaults (min_topic_size=10, UMAP n_neighbors=15) assume a
    # much larger corpus than a single event's feedback — scale both down so
    # real topics can form instead of everything landing in the -1 bucket.
    min_topic_size = max(2, min(5, n_docs // 5))
    n_neighbors = max(2, min(15, n_docs - 1))
    n_components = max(2, min(5, n_docs - 2))

    umap_model = UMAP(
        n_neighbors=n_neighbors,
        n_components=n_components,
        min_dist=0.0,
        metric="cosine",
        random_state=42,
    )
    hdbscan_model = HDBSCAN(
        min_cluster_size=min_topic_size,
        metric="euclidean",
        cluster_selection_method="eom",
        prediction_data=True,
    )

    return BERTopic(
        embedding_model=get_embedding_model(),
        umap_model=umap_model,
        hdbscan_model=hdbscan_model,
        min_topic_size=min_topic_size,
        calculate_probabilities=False,
        verbose=False,
    )


def topic_label(bertopic_name: str) -> str:
    # BERTopic names topics like "0_wifi_signal_connection_room" — drop the
    # leading id (BERTopic's numeric id isn't stored — each run gets fresh
    # DB rows, see feedback_topics) and title-case the rest.
    _, _, rest = bertopic_name.partition("_")
    words = [w for w in rest.split("_") if w]
    return " ".join(w.capitalize() for w in words) if words else bertopic_name


def summarize_topic(items: list[str]) -> str:
    text = " ".join(items)
    if len(text.split()) < 8:
        return text

    summarizer = get_summarizer()
    result = summarizer(text, max_length=130, min_length=30, do_sample=False, truncation=True)
    return result[0]["summary_text"].strip()


def run_pipeline(supabase: Optional[Client]) -> list[dict[str, Any]]:
    feedback_items = load_feedback(supabase)
    if not feedback_items:
        return []

    texts = [text for _, text in feedback_items]

    # BERTopic/UMAP need more docs than clusters to fit meaningfully — below
    # that, treat everything as a single topic rather than erroring.
    if len(feedback_items) < 5:
        return [
            {
                "label": "General feedback",
                "summary": summarize_topic(texts),
                "items": feedback_items,
            }
        ]

    topic_model = build_topic_model(len(texts))
    topic_ids, _ = topic_model.fit_transform(texts)

    items_by_topic: dict[int, list[FeedbackItem]] = {}
    for item, topic_id in zip(feedback_items, topic_ids):
        items_by_topic.setdefault(int(topic_id), []).append(item)

    topics: list[dict[str, Any]] = []
    for _, row in topic_model.get_topic_info().iterrows():
        topic_id = int(row["Topic"])
        if topic_id == -1:
            continue
        items = items_by_topic.get(topic_id, [])
        topics.append(
            {
                "label": topic_label(row["Name"]),
                "summary": summarize_topic([text for _, text in items]),
                "items": items,
            }
        )

    return topics


def save_run(supabase: Optional[Client], cached_at: str, topics: list[dict[str, Any]]) -> None:
    """Writes a run + its topics + item rows across the three feedback_topic_* tables."""
    if supabase is None:
        return
    try:
        run_resp = supabase.table(RUNS_TABLE).insert({"cached_at": cached_at}).execute()
        run_id = run_resp.data[0]["run_id"]

        for topic in topics:
            items: list[FeedbackItem] = topic["items"]
            topic_resp = (
                supabase.table(TOPICS_TABLE)
                .insert(
                    {
                        "run_id": run_id,
                        "label": topic["label"],
                        "summary": topic["summary"],
                        "item_count": len(items),
                    }
                )
                .execute()
            )
            topic_id = topic_resp.data[0]["topic_id"]

            item_rows = [
                {"topic_id": topic_id, "feedback_answer_id": answer_id, "raw_text": text}
                for answer_id, text in items
            ]
            if item_rows:
                supabase.table(TOPIC_ITEMS_TABLE).insert(item_rows).execute()
    except Exception as exc:  # noqa: BLE001
        print(f"[nlp-service] Failed to write feedback topic tables: {exc}", file=sys.stderr)


def fetch_latest_topics(supabase: Optional[Client]) -> TopicsResponse:
    if supabase is None:
        return TopicsResponse(status="not_yet_run", cached_at=None, topics=[])

    try:
        run_resp = (
            supabase.table(RUNS_TABLE).select("run_id, cached_at").order("cached_at", desc=True).limit(1).execute()
        )
        runs = run_resp.data or []
    except Exception as exc:  # noqa: BLE001
        print(f"[nlp-service] Failed to read {RUNS_TABLE}: {exc}", file=sys.stderr)
        runs = []

    if not runs:
        return TopicsResponse(status="not_yet_run", cached_at=None, topics=[])

    run = runs[0]
    topics_resp = (
        supabase.table(TOPICS_TABLE)
        .select("topic_id, label, summary, item_count, feedback_topic_items(raw_text)")
        .eq("run_id", run["run_id"])
        .execute()
    )
    topic_rows = topics_resp.data or []

    topics = [
        Topic(
            topic_id=row["topic_id"],
            label=row["label"],
            item_count=row["item_count"],
            summary=row["summary"],
            items=[i["raw_text"] for i in (row.get("feedback_topic_items") or [])],
        )
        for row in topic_rows
    ]

    return TopicsResponse(status="ok", cached_at=run["cached_at"], topics=topics)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@app.get("/api/feedback/topics", response_model=TopicsResponse)
def get_topics() -> TopicsResponse:
    return fetch_latest_topics(get_supabase())


@app.post("/api/feedback/topics/refresh", response_model=TopicsResponse)
def refresh_topics() -> TopicsResponse:
    supabase = get_supabase()
    topics = run_pipeline(supabase)
    save_run(supabase, now_iso(), topics)
    # Re-read rather than trust in-memory data — confirms what actually landed.
    return fetch_latest_topics(supabase)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
