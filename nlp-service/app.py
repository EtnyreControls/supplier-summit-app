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

# HDBSCAN requires enough densely-packed items to form a cluster at all, so
# small batches (an event with only a handful of feedback items) always came
# back as noise. A distance threshold merges items greedily up to a cosine-
# distance cutoff instead, which works the same way at any batch size —
# including N=1 or N=2 — with no minimum-density requirement.
DISTANCE_THRESHOLD = 0.3

QUESTION_GROUPS_TABLE = "question_groups"
QUESTIONS_TABLE = "questions"
# Questions need a model tuned for query/question *intent* matching (trained
# on question-answer pairs) rather than general sentence similarity — two
# attendees can phrase the same question totally differently ("will there be
# a recording?" vs "can I watch this later?"), which a surface-wording model
# like EMBEDDING_MODEL_NAME would miss. This happens to name the same
# underlying model as Feedback's today, but it's kept as its own constant
# and its own loader (get_questions_embedding_model) so the two pipelines
# stay independently swappable and never get consolidated into one.
QUESTIONS_EMBEDDING_MODEL = "sentence-transformers/multi-qa-mpnet-base-dot-v1"
# Grouping Questions is near-duplicate detection ("is this the same question
# as that one"), not thematic clustering — so clustering algorithms are the
# wrong primitive: HDBSCAN needs several densely-packed items to form a
# cluster at all, and Agglomerative needs a distance threshold guessed in
# advance. Connected components over a similarity graph has neither
# limitation — it works the same way at any batch size, including N=1 or
# N=2, since every question starts as its own singleton component and only
# merges when it's actually similar enough to another one.
QUESTION_SIMILARITY_THRESHOLD = 0.75

app = FastAPI(title="Supplier Summit NLP Service")

_embedding_model = None
_questions_embedding_model = None
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


class QuestionGroup(BaseModel):
    group_id: str
    composed_question: str
    item_count: int
    questions: list[str]


class QuestionGroupsResponse(BaseModel):
    status: str
    regrouped_at: str
    groups: list[QuestionGroup]


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


def get_questions_embedding_model():
    global _questions_embedding_model
    if _questions_embedding_model is None:
        from sentence_transformers import SentenceTransformer

        _questions_embedding_model = SentenceTransformer(QUESTIONS_EMBEDDING_MODEL)
    return _questions_embedding_model


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
    from sklearn.cluster import AgglomerativeClustering
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
    # BERTopic accepts any clustering model exposing .fit()/.labels_ via the
    # hdbscan_model param, despite the name — see DISTANCE_THRESHOLD above
    # for why agglomerative clustering replaced HDBSCAN here. Items whose
    # nearest merge exceeds DISTANCE_THRESHOLD are left as their own
    # singleton cluster rather than forced into an unrelated one — the
    # default behavior once distance_threshold is set with n_clusters=None.
    clustering_model = AgglomerativeClustering(
        n_clusters=None,
        metric="cosine",
        linkage="average",
        distance_threshold=DISTANCE_THRESHOLD,
    )

    return BERTopic(
        embedding_model=get_embedding_model(),
        umap_model=umap_model,
        hdbscan_model=clustering_model,
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


def group_questions(texts: list[str]) -> list[int]:
    """Assigns each text a group label via cosine similarity + connected components.

    Grouping questions is near-duplicate detection ("did two attendees ask
    the same thing"), not thematic clustering, so a similarity graph is the
    right model: any two texts more similar than QUESTION_SIMILARITY_THRESHOLD
    are connected, and each connected component becomes one group. Unlike
    HDBSCAN/Agglomerative clustering, this needs no minimum cluster size and
    no distance threshold guessed from corpus size — it works identically
    whether there are 2 questions or 200, and a question with no match simply
    ends up in a component by itself.
    """
    if len(texts) < 2:
        return list(range(len(texts)))

    import numpy as np
    from scipy.sparse import csr_matrix
    from scipy.sparse.csgraph import connected_components

    model = get_questions_embedding_model()
    embeddings = model.encode(texts, normalize_embeddings=True)

    # Embeddings are L2-normalized, so their dot product is cosine similarity.
    similarity = embeddings @ embeddings.T
    adjacency = similarity > QUESTION_SIMILARITY_THRESHOLD
    np.fill_diagonal(adjacency, False)

    _, labels = connected_components(csr_matrix(adjacency), directed=False)
    return labels.tolist()


def _pending_question_groups(supabase: Client) -> list[dict[str, Any]]:
    """question_groups still open for regrouping: not yet answered or triaged.

    Anything a speaker has already answered or analytics has already checked
    off is left alone — retroactively merging answered questions raises
    "whose answer wins" questions this pipeline doesn't try to solve.
    """
    resp = (
        supabase.table(QUESTION_GROUPS_TABLE)
        .select("group_id, composed_question, topic, created_at, questions(question_id, submission_info, topic)")
        .eq("status", "pending")
        .eq("checked", False)
        .order("created_at")
        .execute()
    )
    return resp.data or []


def _question_group_summaries(group_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    summaries = []
    for row in group_rows:
        questions = row.get("questions") or []
        texts = [q.get("submission_info") or q.get("topic") or "" for q in questions]
        summaries.append(
            {
                "group_id": row["group_id"],
                "composed_question": row.get("composed_question") or (texts[0] if texts else ""),
                "item_count": len(questions),
                "questions": texts,
            }
        )
    return summaries


def run_questions_pipeline(supabase: Optional[Client]) -> list[dict[str, Any]]:
    if supabase is None:
        return []

    try:
        group_rows = _pending_question_groups(supabase)
    except Exception as exc:  # noqa: BLE001
        print(f"[nlp-service] Failed to read question_groups for regrouping: {exc}", file=sys.stderr)
        return []

    # One row per question, in group-creation order — ordering by created_at
    # above means the first group encountered for a given component is
    # always its oldest, which is what makes it the merge survivor below.
    flat: list[dict[str, Any]] = []
    for row in group_rows:
        for question in row.get("questions") or []:
            text = (
                question.get("submission_info")
                or question.get("topic")
                or row.get("composed_question")
                or row.get("topic")
                or ""
            )
            flat.append(
                {
                    "question_id": question["question_id"],
                    "group_id": row["group_id"],
                    "text": text.strip(),
                }
            )

    if len(flat) >= 2:
        labels = group_questions([item["text"] for item in flat])

        components: dict[int, list[dict[str, Any]]] = {}
        for item, label in zip(flat, labels):
            components.setdefault(label, []).append(item)

        candidate_losers: set[str] = set()

        for members in components.values():
            group_ids = list(dict.fromkeys(m["group_id"] for m in members))
            if len(group_ids) < 2:
                continue  # every member is already in the same group

            survivor_id = group_ids[0]
            to_move = [m["question_id"] for m in members if m["group_id"] != survivor_id]
            composed_question = max((m["text"] for m in members), key=len)

            try:
                supabase.table(QUESTIONS_TABLE).update({"group_id": survivor_id}).in_(
                    "question_id", to_move
                ).execute()
                supabase.table(QUESTION_GROUPS_TABLE).update(
                    {"composed_question": composed_question}
                ).eq("group_id", survivor_id).execute()
            except Exception as exc:  # noqa: BLE001
                print(
                    f"[nlp-service] Failed to merge question groups {group_ids[1:]} into {survivor_id}: {exc}",
                    file=sys.stderr,
                )
                continue

            candidate_losers.update(group_ids[1:])

        # Only delete a losing group once nothing references it anymore —
        # question_groups has no ON DELETE SET NULL, so deleting one that
        # still has a question attached would cascade-delete that question.
        for loser_id in candidate_losers:
            try:
                remaining = (
                    supabase.table(QUESTIONS_TABLE).select("question_id").eq("group_id", loser_id).limit(1).execute()
                )
                if not (remaining.data or []):
                    supabase.table(QUESTION_GROUPS_TABLE).delete().eq("group_id", loser_id).execute()
            except Exception as exc:  # noqa: BLE001
                print(f"[nlp-service] Failed to clean up question group {loser_id}: {exc}", file=sys.stderr)

    try:
        group_rows = _pending_question_groups(supabase)
    except Exception as exc:  # noqa: BLE001
        print(f"[nlp-service] Failed to re-read question_groups after regrouping: {exc}", file=sys.stderr)
        return []

    return _question_group_summaries(group_rows)


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


@app.post("/api/questions/groups/refresh", response_model=QuestionGroupsResponse)
def refresh_question_groups() -> QuestionGroupsResponse:
    supabase = get_supabase()
    groups = run_questions_pipeline(supabase)
    return QuestionGroupsResponse(status="ok", regrouped_at=now_iso(), groups=groups)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
