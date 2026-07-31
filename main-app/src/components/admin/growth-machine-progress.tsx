"use client";
import * as React from "react";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { EmptyState } from "../feedback";

export type GrowthMachineTableStatus = "not_started" | "building" | "submitted";

export interface GrowthMachineTableProgress {
  tableId: string;
  tableName: string;
  status: GrowthMachineTableStatus;
  builderName: string | null;
  memberCount: number;
  submissionCount: number;
  lastSubmittedAt: string | null;
}

export interface GrowthMachineBoardSummary {
  boardId: string;
  tableId: string;
  tableName: string;
  submittedByName: string;
  createdAt: string;
}

/* Same visual grammar as MyQuestionsList's statusChip: a yellow dot pill for
   "done", an amber tonal chip for "in progress", and a plain outlined chip
   for the not-yet-started default. */
function statusChip(status: GrowthMachineTableStatus) {
  if (status === "submitted") {
    return (
      <Chip
        size="small"
        variant="outlined"
        icon={<span className="ml-1.5 block h-[7px] w-[7px] rounded-full bg-yellow" />}
        label="Submitted"
        className="border-grey-200 text-ink"
      />
    );
  }
  if (status === "building") {
    return (
      <Chip
        size="small"
        icon={<EditRoundedIcon sx={{ fontSize: 15 }} />}
        label="Building"
        sx={{
          bgcolor: "var(--summit-amber-100)",
          color: "var(--summit-amber-900)",
          "& .MuiChip-icon": { color: "var(--summit-amber-700)" },
        }}
      />
    );
  }
  return <Chip size="small" variant="outlined" label="Not started" className="border-grey-200 text-grey-500" />;
}

/**
 * Cheap, DB-only progress signal per table: whether a board has been
 * submitted (growth_machine_boards row exists), a builder currently holds
 * the seat (event_table_members.is_builder), or neither yet. Doesn't reflect
 * in-progress drawing content — that only lives in the tldraw sync-server's
 * live room, not Postgres — just enough to tell analytics which tables to
 * go check on.
 */
export function GrowthMachineProgress({ tables }: { tables: GrowthMachineTableProgress[] }) {
  if (tables.length === 0) {
    return (
      <EmptyState
        icon={<GroupsRoundedIcon sx={{ fontSize: 32 }} />}
        title="No tables yet"
        body="Tables appear here once attendees are assigned."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tables.map((t) => (
        <div
          key={t.tableId}
          className="flex items-center justify-between gap-3 rounded-(--radius-card) border border-grey-200 bg-surface px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{t.tableName}</p>
            <p className="truncate text-xs text-grey-500">
              {t.memberCount} {t.memberCount === 1 ? "member" : "members"}
              {t.builderName ? ` · ${t.builderName} building` : ""}
            </p>
          </div>
          {statusChip(t.status)}
        </div>
      ))}
    </div>
  );
}

/**
 * Metadata-only list — the document snapshot itself can be large, so it's
 * fetched on demand via getGrowthMachineBoardSnapshot when "View" is
 * clicked (see analytics-page-client.tsx), not included here.
 */
export function GrowthMachineSubmissions({
  boards,
  onView,
  loadingBoardId,
}: {
  boards: GrowthMachineBoardSummary[];
  onView: (boardId: string) => void;
  loadingBoardId: string | null;
}) {
  if (boards.length === 0) {
    return (
      <EmptyState
        icon={<GroupsRoundedIcon sx={{ fontSize: 32 }} />}
        title="No submissions yet"
        body="Submitted boards will show up here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {boards.map((b) => (
        <div
          key={b.boardId}
          className="flex items-center justify-between gap-3 rounded-(--radius-card) border border-grey-200 bg-surface px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{b.tableName}</p>
            <p className="truncate text-xs text-grey-500">
              {b.submittedByName} · {new Date(b.createdAt).toLocaleString()}
            </p>
          </div>
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            startIcon={
              loadingBoardId === b.boardId ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <VisibilityRoundedIcon fontSize="small" />
              )
            }
            disabled={loadingBoardId === b.boardId}
            onClick={() => onView(b.boardId)}
          >
            View
          </Button>
        </div>
      ))}
    </div>
  );
}
