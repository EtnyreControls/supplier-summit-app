"""Feedback topic clustering + summarization service.

Clusters supplier_feedback rows into topics with BERTopic and generates a
plain-English summary per topic with a local BART model. Everything runs
on-device — no paid APIs, no API keys for the ML side. Results are cached
in Supabase (nlp_feedback_cache) so GET /api/feedback/topics is cheap and
POST /api/feedback/topics/refresh is the only path that re-runs the pipeline.
"""

from __future__ import annotations

import os
import sys
import uuid
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
FEEDBACK_TABLE = "supplier_feedback"
FEEDBACK_COLUMN = "feedback_text"
CACHE_TABLE = "nlp_feedback_cache"

app = FastAPI(title="Supplier Summit NLP Service")

_embedding_model = None
_summarizer = None


class Topic(BaseModel):
    topic_id: int
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


def load_feedback(supabase: Optional[Client]) -> list[str]:
    """Reads supplier_feedback.feedback_text; falls back to sample data.

    Any Supabase error (missing table, no connection, etc.) is treated the
    same as "no data" so local development works without a live DB.
    """
    if supabase is not None:
        try:
            resp = supabase.table(FEEDBACK_TABLE).select(FEEDBACK_COLUMN).execute()
            rows = resp.data or []
            texts = [
                row[FEEDBACK_COLUMN].strip()
                for row in rows
                if row.get(FEEDBACK_COLUMN) and row[FEEDBACK_COLUMN].strip()
            ]
            if texts:
                return texts
        except Exception as exc:  # noqa: BLE001
            print(f"[nlp-service] Supabase feedback query failed, using sample data: {exc}", file=sys.stderr)

    return list(SAMPLE_FEEDBACK)


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
    # leading id (redundant with the topic_id field) and title-case the rest.
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
    feedback = load_feedback(supabase)
    if not feedback:
        return []

    # BERTopic/UMAP need more docs than clusters to fit meaningfully — below
    # that, treat everything as a single topic rather than erroring.
    if len(feedback) < 5:
        return [
            {
                "topic_id": 0,
                "label": "General feedback",
                "item_count": len(feedback),
                "summary": summarize_topic(feedback),
                "items": feedback,
            }
        ]

    topic_model = build_topic_model(len(feedback))
    topic_ids, _ = topic_model.fit_transform(feedback)

    items_by_topic: dict[int, list[str]] = {}
    for text, topic_id in zip(feedback, topic_ids):
        items_by_topic.setdefault(int(topic_id), []).append(text)

    topics: list[dict[str, Any]] = []
    for _, row in topic_model.get_topic_info().iterrows():
        topic_id = int(row["Topic"])
        if topic_id == -1:
            continue
        items = items_by_topic.get(topic_id, [])
        topics.append(
            {
                "topic_id": topic_id,
                "label": topic_label(row["Name"]),
                "item_count": len(items),
                "summary": summarize_topic(items),
                "items": items,
            }
        )

    return topics


def save_cache(supabase: Optional[Client], cached_at: str, topics: list[dict[str, Any]]) -> None:
    if supabase is None:
        return
    try:
        supabase.table(CACHE_TABLE).insert(
            {
                "id": str(uuid.uuid4()),
                "cached_at": cached_at,
                "results": {"topics": topics},
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        print(f"[nlp-service] Failed to write nlp_feedback_cache: {exc}", file=sys.stderr)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@app.get("/api/feedback/topics", response_model=TopicsResponse)
def get_topics() -> TopicsResponse:
    supabase = get_supabase()
    if supabase is None:
        return TopicsResponse(status="not_yet_run", cached_at=None, topics=[])

    try:
        resp = (
            supabase.table(CACHE_TABLE)
            .select("*")
            .order("cached_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
    except Exception as exc:  # noqa: BLE001
        print(f"[nlp-service] Failed to read nlp_feedback_cache: {exc}", file=sys.stderr)
        rows = []

    if not rows:
        return TopicsResponse(status="not_yet_run", cached_at=None, topics=[])

    row = rows[0]
    results = row.get("results") or {}
    topics = results.get("topics", [])
    return TopicsResponse(status="ok", cached_at=row.get("cached_at"), topics=topics)


@app.post("/api/feedback/topics/refresh", response_model=TopicsResponse)
def refresh_topics() -> TopicsResponse:
    supabase = get_supabase()
    topics = run_pipeline(supabase)
    cached_at = now_iso()
    save_cache(supabase, cached_at, topics)
    return TopicsResponse(status="ok", cached_at=cached_at, topics=topics)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
