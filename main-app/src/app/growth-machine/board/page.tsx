"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@mui/material/Button";
import { GrowthMachine, BoardOnboardingTour, AsphaltDistributorLoader } from "@/components";
import { enterGrowthMachine } from "@/lib/supabase/growth-machine";

/**
 * Route: /growth-machine/board?role=builder|spectator&table=<id>
 * The real collaborative canvas, reached only after picking a role on
 * /growth-machine. Builder can draw; anything else (missing/invalid param,
 * someone linking in directly) falls back to Spectator — the safer default
 * for an unauthenticated role param.
 *
 * `table` picks which room's board this is (see GrowthMachine/useSync).
 * /growth-machine fills it with the attendee's assigned table after
 * claiming a role via enter_growth_machine() — the database enforces one
 * builder per table (partial unique index, see the
 * growth_machine_board_sync migration). A missing param still falls back
 * to the shared "default" room for unassigned users and local dev.
 */
function Board() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") === "builder" ? "builder" : "spectator";
  const isBuilder = role === "builder";
  const roomId = searchParams.get("table") ?? "default";

  return (
    <div className="relative h-dvh w-dvw">
      {/* z-[400]: tldraw's own panels sit at z-index 300 (--tl-layer-panels
          in tldraw.css) — anything lower here renders BEHIND them instead
          of staying visible on top. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[400] flex justify-end p-3">
        <Button
          variant="contained"
          className="pointer-events-auto"
          data-tour="leave-board"
          onClick={() => {
            // Leaving as the Builder frees the seat for someone else at the
            // table; best-effort — navigation shouldn't wait on it.
            if (isBuilder) void enterGrowthMachine(false);
            router.push("/growth-machine");
          }}
          sx={{
            bgcolor: "#000",
            color: "#fff",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
            "&:hover": {
              bgcolor: "#000",
              transform: "translateY(-2px)",
              boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
            },
          }}
        >
          Leave board
        </Button>
      </div>

      <GrowthMachine readOnly={!isBuilder} roomId={roomId} />
      <BoardOnboardingTour role={role} />
    </div>
  );
}

export default function GrowthMachineBoardPage() {
  return (
    <React.Suspense fallback={<AsphaltDistributorLoader label="Loading board" />}>
      <Board />
    </React.Suspense>
  );
}
