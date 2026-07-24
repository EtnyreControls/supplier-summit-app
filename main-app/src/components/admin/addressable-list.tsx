"use client";
import * as React from "react";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { AiTag } from "../ai-tag";

export interface AddressableItem {
  id: string;
  text: string;
  count: number; // how many attendees asked/flagged essentially this same item, per AI clustering
  groupCount?: number; // similar items clustered by AI
  groupItems?: string[]; // the raw per-submission text underlying groupCount, shown when expanded
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
  countLabel = "asked",
}: {
  items: AddressableItem[];
  onToggle: (id: string) => void;
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
                      <ul className="mt-2 flex flex-col gap-1.5 border-l-2 border-grey-200 pl-3">
                        {item.groupItems.map((text, i) => (
                          <li key={i} className="text-[13px] leading-relaxed text-grey-600">
                            {text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
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
