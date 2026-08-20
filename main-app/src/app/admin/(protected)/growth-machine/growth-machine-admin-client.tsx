"use client";
import * as React from "react";
import { DataTable, useToast } from "@/components";
import {
  deleteGmEntry,
  deleteGmBoard,
  deleteGmVote,
  type AdminGmEntry,
  type AdminGmBoard,
  type AdminGmVote,
} from "@/lib/supabase/admin/admin-growth-machine";

// Entries/boards/votes are all produced by the live board flow (see
// components/text.tsx) — moderation here is read + delete only, no
// hand-authored create/edit (a jsonb tldraw snapshot isn't editable as a
// form field anyway).
export function GrowthMachineAdminClient({
  initialEntries,
  initialBoards,
  initialVotes,
}: {
  initialEntries: AdminGmEntry[];
  initialBoards: AdminGmBoard[];
  initialVotes: AdminGmVote[];
}) {
  const { toast, showToast } = useToast();
  const [entries, setEntries] = React.useState(initialEntries.map((e) => ({ ...e, id: e.uid })));
  const [boards, setBoards] = React.useState(initialBoards.map((b) => ({ ...b, id: b.board_id })));
  const [votes, setVotes] = React.useState(
    initialVotes.map((v) => ({ ...v, id: `${v.voter_uid}:${v.event_uid}` })),
  );

  const withErrorToast = async (result: { error: string | null }) => {
    if (result.error) showToast(result.error, "error");
    return result;
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <h1 className="text-xl font-bold text-ink">Growth Machine</h1>

      <DataTable
        title="Entries"
        columns={[
          { key: "part", label: "Part" },
          { key: "content", label: "Content" },
          { key: "table_id", label: "Table ID" },
        ]}
        rows={entries}
        onDelete={async (row) => {
          const result = await withErrorToast(await deleteGmEntry(row.id));
          if (!result.error) setEntries((prev) => prev.filter((e) => e.id !== row.id));
        }}
      />

      <DataTable
        title="Submitted boards"
        columns={[
          { key: "table_id", label: "Table ID" },
          { key: "submitted_by", label: "Submitted by" },
          { key: "created_at", label: "Created" },
        ]}
        rows={boards}
        onDelete={async (row) => {
          const result = await withErrorToast(await deleteGmBoard(row.id));
          if (!result.error) setBoards((prev) => prev.filter((b) => b.id !== row.id));
        }}
      />

      <DataTable
        title="Votes"
        columns={[
          { key: "voter_uid", label: "Voter" },
          { key: "table_id", label: "Table ID" },
          { key: "voted_at", label: "Voted at" },
        ]}
        rows={votes}
        onDelete={async (row) => {
          const result = await withErrorToast(await deleteGmVote(row.voter_uid, row.event_uid));
          if (!result.error) setVotes((prev) => prev.filter((v) => v.id !== row.id));
        }}
      />
      {toast}
    </div>
  );
}
