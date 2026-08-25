"use client";
import * as React from "react";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { AiTag } from "../ai-tag";
import { EmptyState } from "../feedback";

export interface FeedbackTopic {
  topic_id: string;
  label: string;
  item_count: number;
  summary: string;
  items: string[];
  addressed: boolean;
  addressed_at: string | null;
}

export interface FeedbackTopicsResponse {
  status: "ok" | "not_yet_run";
  cached_at: string | null;
  topics: FeedbackTopic[];
}

function formatCachedAt(cachedAt: string | null) {
  if (!cachedAt) return "—";
  const date = new Date(cachedAt);
  if (Number.isNaN(date.getTime())) return cachedAt;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Ranked, checkable — mirrors sortAddressable (see addressable-list.tsx):
 * unaddressed topics sort by size (most-raised first), checking one moves it
 * into the addressed group at the bottom, ordered by when it was checked off.
 */
export function sortTopics(topics: FeedbackTopic[]): FeedbackTopic[] {
  return [...topics].sort((a, b) => {
    if (a.addressed !== b.addressed) return a.addressed ? 1 : -1;
    if (!a.addressed) return b.item_count - a.item_count;
    return (a.addressed_at ? Date.parse(a.addressed_at) : 0) - (b.addressed_at ? Date.parse(b.addressed_at) : 0);
  });
}

/**
 * BERTopic + BART topic clustering for supplier_feedback, proxied through
 * /api/feedback/topics/refresh to the local nlp-service (port 8080).
 * Initial data comes from the server (page.tsx queries feedback_topics
 * directly, in the same request as everything else on the page) — this
 * component only re-fetches when Refresh re-runs the pipeline. Addressed
 * state is a plain per-topic flag (toggleFeedbackTopicAddressed), the same
 * pattern as question groups; this is the single "Feedback" worklist —
 * there's no separate raw-submissions list anymore, since a raw submission
 * IS a topic's item.
 */
export function FeedbackTopics({
  data,
  onToggleAddressed,
  onRefreshed,
  showToast,
}: {
  data: FeedbackTopicsResponse;
  onToggleAddressed: (topicId: string, addressed: boolean) => Promise<{ error: string | null }>;
  onRefreshed: (data: FeedbackTopicsResponse) => void;
  showToast?: (message: string, severity?: "success" | "error" | "info") => void;
}) {
  const [refreshing, setRefreshing] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/feedback/topics/refresh", { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      const json: FeedbackTopicsResponse = await res.json();
      // A refresh re-runs clustering and writes brand-new topic rows, so
      // there's nothing to inherit "addressed" from — every topic here is
      // implicitly new and unaddressed.
      onRefreshed({
        ...json,
        topics: json.topics.map((t) => ({ ...t, addressed: false, addressed_at: null })),
      });
      showToast?.("Feedback topics refreshed");
    } catch {
      showToast?.("Couldn't refresh feedback topics", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggle = async (topicId: string, next: boolean) => {
    const { error } = await onToggleAddressed(topicId, next);
    if (error) showToast?.(error, "error");
  };

  const refreshButton = (
    <Button
      variant="contained"
      size="small"
      onClick={handleRefresh}
      disabled={refreshing}
      startIcon={
        refreshing ? <CircularProgress size={14} color="inherit" /> : <RefreshRoundedIcon fontSize="small" />
      }
    >
      {refreshing ? "Running…" : "Refresh"}
    </Button>
  );

  if (data.status === "not_yet_run") {
    return <EmptyState title="No results yet — click Refresh to run the pipeline" action={refreshButton} />;
  }

  const sorted = sortTopics(data.topics);
  const openCount = sorted.filter((t) => !t.addressed).length;
  const addressedCount = sorted.length - openCount;
  let rank = 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-grey-600">Last updated: {formatCachedAt(data.cached_at)}</p>
        {refreshButton}
      </div>

      {sorted.length === 0 ? (
        <EmptyState title="No topics found" body="The last run didn't surface any topics." />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((topic, idx) => {
            const isFirstAddressed = topic.addressed && idx === openCount;
            if (!topic.addressed) rank += 1;
            return (
              <React.Fragment key={topic.topic_id}>
                {isFirstAddressed && addressedCount > 0 && (
                  <p className="mb-0.5 mt-3 text-xs font-semibold uppercase tracking-wider text-grey-500">
                    Addressed ({addressedCount})
                  </p>
                )}
                <Card className={`p-4 transition-opacity ${topic.addressed ? "opacity-55" : ""}`}>
                  <div className="flex items-start gap-3">
                    {!topic.addressed && (
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-grey-100 text-xs font-bold text-grey-700">
                        {rank}
                      </span>
                    )}
                    <Checkbox
                      checked={topic.addressed}
                      onChange={() => handleToggle(topic.topic_id, !topic.addressed)}
                      size="small"
                      sx={{ mt: topic.addressed ? 0 : -0.5, p: 0.5 }}
                      slotProps={{
                        input: { "aria-label": topic.addressed ? "Mark as unaddressed" : "Mark as addressed" },
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p
                          className={`text-[15px] font-semibold text-ink ${
                            topic.addressed ? "text-grey-500 line-through" : ""
                          }`}
                        >
                          {topic.label}
                        </p>
                        <Chip size="small" label={`${topic.item_count} item${topic.item_count === 1 ? "" : "s"}`} />
                      </div>

                      <div className="mt-2">
                        <AiTag
                          label="AI-summarized"
                          detail="Generated locally from clustered feedback with BART — no external API calls."
                        />
                      </div>

                      <p className="mt-2 text-[14px] leading-relaxed text-grey-700">{topic.summary}</p>

                      <Accordion
                        disableGutters
                        square
                        elevation={0}
                        className="mt-3 border-t border-grey-200 !bg-transparent before:hidden"
                        expanded={expanded.has(topic.topic_id)}
                        onChange={() => toggleExpanded(topic.topic_id)}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 0 }}>
                          <span className="text-[13px] font-medium text-grey-600">
                            Show raw feedback ({topic.items.length})
                          </span>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 0 }}>
                          <ul className="flex flex-col gap-1.5">
                            {topic.items.map((item, itemIdx) => (
                              <li key={itemIdx} className="text-[13px] leading-relaxed text-grey-700">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </AccordionDetails>
                      </Accordion>
                    </div>
                  </div>
                </Card>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
