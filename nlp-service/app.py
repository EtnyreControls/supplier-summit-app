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

EMBEDDING_MODEL_NAME = "sentence-transformers/all-mpnet-base-v2"
SUMMARIZATION_MODEL_NAME = "facebook/bart-large-cnn"
ANSWERS_TABLE = "feedback_answers"
RUNS_TABLE = "feedback_topic_runs"
TOPICS_TABLE = "feedback_topics"
TOPIC_ITEMS_TABLE = "feedback_topic_items"

# (feedback_answer_id, text) — id is None for sample-data fallback items,
# since there's no real row to link to.
FeedbackItem = tuple[Optional[str], str]

QUESTION_GROUPS_TABLE = "question_groups"
QUESTIONS_TABLE = "questions"
# Questions need a model tuned for query/question *intent* matching (trained
# on question-answer pairs) rather than general sentence similarity — two
# attendees can phrase the same question totally differently ("will there be
# a recording?" vs "can I watch this later?"), which a general-purpose model
# like EMBEDDING_MODEL_NAME would miss. Kept as its own constant and its own
# loader (get_questions_embedding_model) so the two pipelines stay
# independently swappable and never get consolidated into one.
QUESTIONS_EMBEDDING_MODEL = "sentence-transformers/multi-qa-mpnet-base-dot-v1"
# Grouping Questions is near-duplicate detection ("is this the same question
# as that one"), not thematic clustering — so clustering algorithms are the
# wrong primitive: HDBSCAN needs several densely-packed items to form a
# cluster at all, and Agglomerative needs a distance threshold guessed in
# advance. Connected components over a similarity graph has neither
# limitation — it works the same way at any batch size, including N=1 or
# N=2, since every question starts as its own singleton component and only
# merges when it's actually similar enough to another one.
QUESTION_SIMILARITY_THRESHOLD = 0.65

SPEAKERS_TABLE = "speakers"
QUESTION_ROUTING_TABLE = "question_routing"
# The fixed speakers row analytics_logistics_speaker.sql seeds — not a real
# person (user_id/event_id both null on that row), just a stable routing
# target. Used both as its own tag destination (General, Growth Machine,
# Walk Gallery — see TAG_SPEAKER_IDS) and as the universal escalation step
# for every other tag, so any tag's chain always has somewhere to land.
ANALYTICS_SPEAKER_ID = "00000000-0000-0000-0000-00000000a17c"
# Attendee-picked topic tag (QUESTION_TOPICS in question-fab.tsx, lowercased)
# -> that session's dedicated speaker_id. Looked up straight from the real
# agenda (see event table) rather than guessed: e.g. "Supplier Connection
# Challenge" matches the "Registration, Breakfast, Networking & Supplier
# Connection Challenge (Icebreaker)" session's speaker. Tags absent here
# (Strategic Partnership today — that session has no speaker assigned in the
# database yet) fall straight through to the Analytics escalation step in
# route_question, same as a tag that IS mapped but already declined.
TAG_SPEAKER_IDS = {
    "general": ANALYTICS_SPEAKER_ID,
    "growth machine": ANALYTICS_SPEAKER_ID,
    # No per-unit tags yet (Etnyre/BearCat/SMF/Hendrick each need their own
    # speaker, pending a stakeholder decision) — routes to Analytics, who
    # can manually reassign to the right unit's speaker via the existing
    # Reassign dropdown.
    "walk gallery": ANALYTICS_SPEAKER_ID,
    "supplier connection challenge": "60157b0c-c694-4f19-b1d7-c51732762ab8",
    "summit objectives": "31be750c-fd1c-494a-9bdb-816cd7f59cb1",
    "executive growth strategy": "f774ab2c-2ac9-4125-b1b4-cc89076ea4ba",
    "global growth": "e759a745-73c1-45db-824e-c0ac0e5dc215",
}
# Calibrated against real questions/speaker bios in this deployment (see
# the routing-feature migration history) — cosine similarity here mostly
# lands in a 0.22-0.39 band with no clean bimodal split, so this isn't a
# "confident vs not" cliff, just a line under the clearly-nonsensical
# matches (a fleet-maintenance question landing on the CEO's session, etc).
# Adjust if real usage shows it's too aggressive/lenient.
MIN_ROUTING_SIMILARITY = 0.28

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


class RouteQuestionRequest(BaseModel):
    question_id: str
    question_text: str


class RouteResult(BaseModel):
    status: str  # "routed" | "unrouted" | "error"
    question_id: str
    speaker_id: Optional[str] = None
    similarity_score: Optional[float] = None
    attempt_number: Optional[int] = None


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
    from sklearn.feature_extraction.text import CountVectorizer
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

    # c-TF-IDF (which docs get treated as "close to" a topic, including
    # which ones qualify as representative_docs_ — see topic_label) is
    # otherwise dominated by stopwords like "the"/"was"/"during", since
    # feedback sentences are short enough that a couple of stopwords can
    # outweigh the actual content words.
    vectorizer_model = CountVectorizer(stop_words="english")

    # No hdbscan_model override — uses BERTopic's built-in HDBSCAN clustering
    # with default settings. Note: HDBSCAN needs enough densely-packed items
    # to form a cluster at all, so small batches (an event with only a
    # handful of feedback items) can land entirely in the -1 "noise" bucket.
    return BERTopic(
        embedding_model=get_embedding_model(),
        umap_model=umap_model,
        vectorizer_model=vectorizer_model,
        min_topic_size=min_topic_size,
        calculate_probabilities=False,
        verbose=False,
    )


def topic_label(representative_docs: list[str]) -> str:
    # BERTopic's auto-generated Name (top c-TF-IDF words strung together,
    # e.g. "0_wifi_signal_connection_room") reads as keyword salad, not a
    # label — and a short BART generation with a tight max_length just
    # truncates mid-sentence instead of producing a real headline. A real
    # attendee sentence is grammatical and on-topic by construction, so pick
    # the shortest of BERTopic's representative docs (the real items closest
    # to the topic's centroid) as the label instead of generating one.
    if not representative_docs:
        return "General feedback"

    label = min(representative_docs, key=len).strip()
    max_len = 90
    if len(label) > max_len:
        label = label[:max_len].rsplit(" ", 1)[0].rstrip(",.;:—-") + "…"
    return label


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
        representative_docs = topic_model.get_representative_docs(topic_id) or []
        topics.append(
            {
                "label": topic_label(representative_docs),
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


def _embed_texts(texts: list[str]) -> list[list[float]]:
    model = get_questions_embedding_model()
    return model.encode(texts, normalize_embeddings=True).tolist()


# A full bio is self-described role scope, not curated session content — a
# broad title ("VP Supply Chain oversees supply chain strategy...") shares
# vocabulary with nearly every question in that domain, so it was winning
# matches on breadth alone rather than actual session relevance (see the
# "when is lunch" -> "breakfast logistics" bio mismatch). The real fix is
# routing by session/agenda content instead of bio (tracked separately,
# pending the topic-tag redesign) — this is a stopgap: clip the bio short
# so it still adds a little identity/context but can no longer out-mass the
# event topic/description, which stays untruncated as the primary signal.
BIO_EMBEDDING_CHAR_LIMIT = 60


def _truncate_bio(bio: str) -> str:
    bio = bio.strip()
    if len(bio) <= BIO_EMBEDDING_CHAR_LIMIT:
        return bio
    # Cut at the last word boundary within the limit rather than mid-word.
    clipped = bio[:BIO_EMBEDDING_CHAR_LIMIT].rsplit(" ", 1)[0]
    return f"{clipped}..."


def _speaker_embedding_text(bio: str, event: Optional[dict]) -> str:
    """The linked event's topic/description is what's actually
    topic-specific ("Global sourcing strategy, resilience, localization,
    innovation, cost competitiveness...") — bio is included only as a
    clipped identity hint (see _truncate_bio), not full context. This is the
    single source of truth for "what text represents this speaker" — reused
    by both the lazy background-fill path and the forced recompute script.
    """
    parts = [_truncate_bio(bio)]
    if event:
        if event.get("topic"):
            parts.append(f"Session: {event['topic']}.")
        if event.get("description"):
            parts.append(event["description"].strip())
    return " ".join(parts)


def _ensure_speaker_embeddings(supabase: Client) -> None:
    """Computes + caches embeddings for speakers that don't have one yet.

    Reuses the same multi-qa-mpnet-base-dot-v1 model as question grouping
    (get_questions_embedding_model) so question and speaker embeddings land
    in the same vector space and cosine similarity between them means
    something. Only speakers with embedding IS NULL do any work here — this
    is the "precomputed, don't recompute on every question" cache
    speakers.embedding exists for.
    """
    # speakers<->event has two FK paths (speakers.event_id, and the
    # separate event.speaker_id "featured speaker" column) — PostgREST
    # can't disambiguate a bare "event(...)" embed, so the FK constraint
    # name is required. speakers_event_uid_fkey is speakers.event_id, the
    # one that means "the event this speaker row is FOR".
    resp = (
        supabase.table(SPEAKERS_TABLE)
        .select("speaker_id, bio, event!speakers_event_uid_fkey(topic, description)")
        .is_("embedding", "null")
        .execute()
    )
    rows = [r for r in (resp.data or []) if r.get("bio") and r["bio"].strip()]
    if not rows:
        return

    embeddings = _embed_texts([_speaker_embedding_text(r["bio"], r.get("event")) for r in rows])
    for row, embedding in zip(rows, embeddings):
        try:
            supabase.table(SPEAKERS_TABLE).update({"embedding": embedding}).eq(
                "speaker_id", row["speaker_id"]
            ).execute()
        except Exception as exc:  # noqa: BLE001
            print(f"[nlp-service] Failed to cache embedding for speaker {row['speaker_id']}: {exc}", file=sys.stderr)


def route_question(supabase: Client, question_id: str, question_text: str) -> RouteResult:
    """Routes (or re-routes) one question via its attendee-picked topic tag.

    Called once right after a question is submitted, and again on every
    decline. Routing is a deterministic chain per tag (see TAG_SPEAKER_IDS):
    the tag's dedicated speaker (if any), then Analytics as a universal
    escalation step, then unrouted if both are already attempted/declined —
    "the deterministic guess was wrong" and "no single speaker fits" land in
    the same place, a human sorts it out.

    An untagged question (topic null/blank) is treated exactly like
    "General": QUESTION_TOPICS (question-fab.tsx) leaves the picker blank by
    default rather than pre-selecting General, specifically so the two cases
    can be told apart in questions.topic for reporting — they still need the
    same safe destination either way. Never touches questions/question_groups.

    Bio/session-similarity matching (the previous approach) has been
    retired now that every tag has an explicit destination — see git
    history for that implementation if it's ever needed again; the
    now-unused embedding helpers (_ensure_speaker_embeddings,
    _speaker_embedding_text, _truncate_bio) and speakers.embedding column
    are left in place pending a decision on removing them outright.
    """
    routing_resp = (
        supabase.table(QUESTION_ROUTING_TABLE)
        .select("speaker_id, attempt_number")
        .eq("question_id", question_id)
        .execute()
    )
    prior = routing_resp.data or []
    attempted = {r["speaker_id"] for r in prior if r.get("speaker_id")}
    attempt_number = max((r["attempt_number"] for r in prior), default=0) + 1

    # user(first_name, last_name) via the FK on speakers.user_id — safe to
    # join here since this runs as the service-role client (nlp-service's
    # get_supabase()), which isn't subject to analytics' narrower RLS on
    # "user". The name is only ever snapshotted onto question_routing below,
    # never returned to a client directly from this join.
    speakers_resp = supabase.table(SPEAKERS_TABLE).select("speaker_id, user(first_name, last_name)").execute()

    def speaker_display_name(speaker: dict) -> Optional[str]:
        user = speaker.get("user") or {}
        name = " ".join(part for part in (user.get("first_name"), user.get("last_name")) if part)
        return name or None

    name_by_speaker_id = {s["speaker_id"]: speaker_display_name(s) for s in (speakers_resp.data or [])}

    question_resp = (
        supabase.table(QUESTIONS_TABLE).select("topic").eq("question_id", question_id).maybe_single().execute()
    )
    topic = (question_resp.data or {}).get("topic") if question_resp and question_resp.data else None
    tag_key = (topic or "").strip().lower() or "general"

    chain = []
    mapped_speaker_id = TAG_SPEAKER_IDS.get(tag_key)
    if mapped_speaker_id:
        chain.append(mapped_speaker_id)
    if ANALYTICS_SPEAKER_ID not in chain:
        chain.append(ANALYTICS_SPEAKER_ID)
    next_speaker_id = next((s for s in chain if s not in attempted), None)

    if next_speaker_id:
        speaker_name = (
            "Analytics team (logistics)"
            if next_speaker_id == ANALYTICS_SPEAKER_ID
            else name_by_speaker_id.get(next_speaker_id)
        )
        try:
            supabase.table(QUESTION_ROUTING_TABLE).insert(
                {
                    "question_id": question_id,
                    "speaker_id": next_speaker_id,
                    "status": "pending",
                    "attempt_number": attempt_number,
                    "question_text": question_text,
                    "speaker_name": speaker_name,
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001
            print(f"[nlp-service] Failed to route tagged question {question_id}: {exc}", file=sys.stderr)
            return RouteResult(status="error", question_id=question_id)
        return RouteResult(
            status="routed", question_id=question_id, speaker_id=next_speaker_id, attempt_number=attempt_number
        )

    # Chain exhausted (the tag's speaker and Analytics were both already
    # attempted/declined) — no deterministic destination left.
    try:
        supabase.table(QUESTION_ROUTING_TABLE).insert(
            {
                "question_id": question_id,
                "speaker_id": None,
                "status": "unrouted",
                "attempt_number": attempt_number,
                "question_text": question_text,
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        # Partial unique index caps this to one row per question — a
        # duplicate call racing in (e.g. two declines) is a no-op, not an
        # error worth surfacing.
        print(f"[nlp-service] tagged unrouted insert for {question_id} skipped: {exc}", file=sys.stderr)
    return RouteResult(status="unrouted", question_id=question_id, attempt_number=attempt_number)


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


@app.post("/api/questions/route", response_model=RouteResult)
def route_question_endpoint(payload: RouteQuestionRequest) -> RouteResult:
    supabase = get_supabase()
    if supabase is None:
        return RouteResult(status="error", question_id=payload.question_id)
    return route_question(supabase, payload.question_id, payload.question_text)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
