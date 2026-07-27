"use client";
import * as React from "react";
import Card from "@mui/material/Card";
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
 * BERTopic + BART topic clustering for supplier_feedback, proxied through
 * /api/feedback/topics to the local nlp-service (port 8001). GET loads the
 * last cached run; Refresh re-runs the pipeline and re-caches.
 */
export function FeedbackTopics({
  showToast,
}: {
  showToast?: (message: string, severity?: "success" | "error" | "info") => void;
}) {
  const [data, setData] = React.useState<FeedbackTopicsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/feedback/topics");
        if (!res.ok) throw new Error("Failed to load feedback topics");
        const json: FeedbackTopicsResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) showToast?.("Couldn't load feedback topics", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/feedback/topics/refresh", { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      const json: FeedbackTopicsResponse = await res.json();
      setData(json);
      showToast?.("Feedback topics refreshed");
    } catch {
      showToast?.("Couldn't refresh feedback topics", "error");
    } finally {
      setRefreshing(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <CircularProgress size={28} />
      </div>
    );
  }

  if (!data || data.status === "not_yet_run") {
    return <EmptyState title="No results yet — click Refresh to run the pipeline" action={refreshButton} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-grey-600">Last updated: {formatCachedAt(data.cached_at)}</p>
        {refreshButton}
      </div>

      {data.topics.length === 0 ? (
        <EmptyState title="No topics found" body="The last run didn't surface any topics." />
      ) : (
        <div className="flex flex-col gap-3">
          {data.topics.map((topic) => (
            <Card key={topic.topic_id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[15px] font-semibold text-ink">{topic.label}</p>
                <Chip size="small" label={`${topic.item_count} item${topic.item_count === 1 ? "" : "s"}`} />
              </div>

              <div className="mt-2">
                <AiTag label="AI-summarized" detail="Generated locally from clustered feedback with BART — no external API calls." />
              </div>

              <p className="mt-2 text-[14px] leading-relaxed text-grey-700">{topic.summary}</p>

              <Accordion disableGutters square elevation={0} className="mt-3 border-t border-grey-200 !bg-transparent before:hidden">
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 0 }}>
                  <span className="text-[13px] font-medium text-grey-600">
                    Show raw feedback ({topic.items.length})
                  </span>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 0 }}>
                  <ul className="flex flex-col gap-1.5">
                    {topic.items.map((item, idx) => (
                      <li key={idx} className="text-[13px] leading-relaxed text-grey-700">
                        {item}
                      </li>
                    ))}
                  </ul>
                </AccordionDetails>
              </Accordion>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
