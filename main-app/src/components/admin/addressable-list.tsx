"use client";
import * as React from "react";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { AiTag } from "../ai-tag";

export interface AddressableGroupItem {
  id: string;
  text: string;
}

export interface AddressableItem {
  id: string;
  text: string;
  count: number; // how many attendees asked/flagged essentially this same item, per AI clustering
  groupCount?: number; // similar items clustered by AI
  groupItems?: AddressableGroupItem[]; // the raw per-submission entries underlying groupCount, shown when expanded
  answerText?: string | null; // present only where answering is wired up (e.g. Questions, not Feedback)
  addressed: boolean;
  addressedAt: number | null; // sort key among addressed items; null while unaddressed
}

/**
 * Ranked, checkable list for Questions/Feedback. Unaddressed items sort by
 * count (most to least raised); checking one moves it into the addressed
 * group at the bottom, ordered by when it was checked off.
 */
export function sortAddressable(items: AddressableItem[]): AddressableItem[] {
  return [...items].sort((a, b) => {
    if (a.addressed !== b.addressed) return a.addressed ? 1 : -1;
    if (!a.addressed) return b.count - a.count;
    return (a.addressedAt ?? 0) - (b.addressedAt ?? 0);
  });
}

export function AddressableList({
  items,
  onToggle,
  onRemoveGroupItem,
  onSubmitAnswer,
  countLabel = "asked",
}: {
  items: AddressableItem[];
  onToggle: (id: string) => void;
  onRemoveGroupItem?: (groupItemId: string) => void;
  onSubmitAnswer?: (id: string, answerText: string) => void | Promise<void>;
  countLabel?: string;
}) {
  const sorted = sortAddressable(items);
  const openCount = sorted.filter((i) => !i.addressed).length;
  const addressedCount = sorted.length - openCount;
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [answering, setAnswering] = React.useState<Set<string>>(new Set());
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState<Set<string>>(new Set());
  const startAnswering = (item: AddressableItem) => {
    setDrafts((prev) => ({ ...prev, [item.id]: prev[item.id] ?? item.answerText ?? "" }));
    setAnswering((prev) => new Set(prev).add(item.id));
  };
  const cancelAnswering = (id: string) =>
    setAnswering((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  const saveAnswer = async (id: string) => {
    const text = (drafts[id] ?? "").trim();
    if (!text || !onSubmitAnswer) return;
    setSaving((prev) => new Set(prev).add(id));
    try {
      await onSubmitAnswer(id, text);
      cancelAnswering(id);
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };
  let rank = 0;

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((item, idx) => {
        const isFirstAddressed = item.addressed && idx === openCount;
        if (!item.addressed) rank += 1;
        return (
          <React.Fragment key={item.id}>
            {isFirstAddressed && addressedCount > 0 && (
              <p className="mb-0.5 mt-3 text-xs font-semibold uppercase tracking-wider text-grey-500">
                Addressed ({addressedCount})
              </p>
            )}
            <Card
              className={`flex items-start gap-3 p-3.5 transition-opacity ${
                item.addressed ? "opacity-55" : ""
              }`}
            >
              {!item.addressed && (
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-grey-100 text-xs font-bold text-grey-700">
                  {rank}
                </span>
              )}
              <Checkbox
                checked={item.addressed}
                onChange={() => onToggle(item.id)}
                size="small"
                sx={{ mt: item.addressed ? 0 : -0.5, p: 0.5 }}
                slotProps={{ input: { "aria-label": item.addressed ? "Mark as unaddressed" : "Mark as addressed" } }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[14px] leading-relaxed text-ink ${
                    item.addressed ? "text-grey-500 line-through" : ""
                  }`}
                >
                  {item.text}
                </p>
                {!item.addressed && item.groupCount != null && item.groupCount > 1 && (
                  <>
                    <div className="mt-2 flex items-center gap-2">
                      <Chip
                        size="small"
                        clickable
                        onClick={() => toggleExpanded(item.id)}
                        icon={
                          <ExpandMoreRoundedIcon
                            fontSize="small"
                            className={`transition-transform ${expanded.has(item.id) ? "rotate-180" : ""}`}
                          />
                        }
                        label={`${item.groupCount} similar`}
                      />
                      <AiTag
                        label="Grouped by AI"
                        detail="Similar submissions are clustered automatically so patterns surface without reading every raw entry."
                      />
                    </div>
                    {expanded.has(item.id) && item.groupItems && item.groupItems.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1 border-l-2 border-grey-200 pl-3">
                        {item.groupItems.map((gi) => (
                          <li key={gi.id} className="flex items-start justify-between gap-2">
                            <span className="text-[13px] leading-relaxed text-grey-600">{gi.text}</span>
                            {onRemoveGroupItem && (
                              <Tooltip title="Remove from this group">
                                <IconButton
                                  size="small"
                                  aria-label="Remove from this group"
                                  onClick={() => onRemoveGroupItem(gi.id)}
                                  sx={{ mt: -0.5, p: 0.5 }}
                                >
                                  <CloseRoundedIcon fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                {onSubmitAnswer && (
                  <div className="mt-2">
                    {item.answerText && !answering.has(item.id) && (
                      <p className="mb-1.5 rounded-(--radius-control) bg-grey-50 px-3 py-2 text-[13px] text-grey-700">
                        {item.answerText}
                      </p>
                    )}
                    {answering.has(item.id) ? (
                      <div className="flex flex-col gap-1.5">
                        <TextField
                          multiline
                          minRows={2}
                          size="small"
                          autoFocus
                          placeholder="Type an answer for the submitter"
                          value={drafts[item.id] ?? ""}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          sx={{ "& .MuiInputBase-input": { fontSize: 13 } }}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => saveAnswer(item.id)}
                            disabled={!drafts[item.id]?.trim() || saving.has(item.id)}
                          >
                            {saving.has(item.id) ? "Saving…" : "Save answer"}
                          </Button>
                          <Button size="small" variant="text" onClick={() => cancelAnswering(item.id)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="small" variant="text" sx={{ minWidth: 0, px: 0.5 }} onClick={() => startAnswering(item)}>
                        {item.answerText ? "Edit answer" : "Answer"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-center pl-1">
                <span className="text-xs font-semibold text-ink">{item.count}</span>
                <span className="text-[10px] text-grey-500">{countLabel}</span>
              </div>
            </Card>
          </React.Fragment>
        );
      })}
    </div>
  );
}
