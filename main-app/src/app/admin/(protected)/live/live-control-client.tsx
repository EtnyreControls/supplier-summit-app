"use client";
import * as React from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { useToast } from "@/components";
import {
  setEventLive,
  setFeedbackStatus,
  setGrowthMachineSessionLive,
  startGrowthMachineTimer,
  clearGrowthMachineTimer,
  startGeneralCountdown,
  clearGeneralCountdown,
} from "@/lib/supabase/admin/admin-live";

type EventRow = { event_id: string; topic: string; status: string };
type FeedbackRow = { poll_id: string; poll_name: string | null; status: string };
type LiveState = {
  general_countdown_label: string | null;
  general_countdown_ends_at: string | null;
  growth_machine_timer_label: string | null;
  growth_machine_timer_ends_at: string | null;
  growth_machine_session_live: boolean;
} | null;

function TimerForm({
  title,
  active,
  onStart,
  onClear,
}: {
  title: string;
  active: { label: string | null; endsAt: string | null };
  onStart: (label: string, seconds: number) => Promise<{ error: string | null }>;
  onClear: () => Promise<{ error: string | null }>;
}) {
  const { toast, showToast } = useToast();
  const [label, setLabel] = React.useState("");
  const [minutes, setMinutes] = React.useState("5");
  const [busy, setBusy] = React.useState(false);

  const isRunning = active.endsAt != null && new Date(active.endsAt) > new Date();

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await onStart(label, Number(minutes) * 60);
    setBusy(false);
    if (error) showToast(error, "error");
  };

  const handleClear = async () => {
    setBusy(true);
    const { error } = await onClear();
    setBusy(false);
    if (error) showToast(error, "error");
  };

  return (
    <div className="rounded-(--radius-card) border border-grey-200 p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {isRunning ? (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm text-grey-700">
            &ldquo;{active.label}&rdquo; ends at {new Date(active.endsAt!).toLocaleTimeString()}
          </p>
          <Button size="small" variant="outlined" color="secondary" disabled={busy} onClick={handleClear}>
            Stop
          </Button>
        </div>
      ) : (
        <form onSubmit={handleStart} className="mt-2 flex flex-wrap items-end gap-2">
          <TextField
            size="small"
            label="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
          <TextField
            size="small"
            label="Minutes"
            type="number"
            slotProps={{ htmlInput: { min: 1 } }}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            sx={{ width: 100 }}
          />
          <Button type="submit" variant="contained" color="primary" size="small" disabled={busy}>
            Start
          </Button>
        </form>
      )}
      {toast}
    </div>
  );
}

export function LiveControlClient({
  initialEvents,
  initialFeedback,
  initialLiveState,
}: {
  initialEvents: EventRow[];
  initialFeedback: FeedbackRow[];
  initialLiveState: LiveState;
}) {
  const { toast, showToast } = useToast();
  const [events, setEvents] = React.useState(initialEvents);
  const [feedback, setFeedback] = React.useState(initialFeedback);
  const [liveState, setLiveState] = React.useState(initialLiveState);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [gmSessionBusy, setGmSessionBusy] = React.useState(false);

  const toggleGrowthMachineSession = async () => {
    setGmSessionBusy(true);
    const nextLive = !liveState?.growth_machine_session_live;
    const { error } = await setGrowthMachineSessionLive(nextLive);
    setGmSessionBusy(false);
    if (error) {
      showToast(error, "error");
      return;
    }
    setLiveState((prev) => ({
      general_countdown_label: prev?.general_countdown_label ?? null,
      general_countdown_ends_at: prev?.general_countdown_ends_at ?? null,
      growth_machine_timer_label: prev?.growth_machine_timer_label ?? null,
      growth_machine_timer_ends_at: prev?.growth_machine_timer_ends_at ?? null,
      growth_machine_session_live: nextLive,
    }));
  };

  const toggleEvent = async (event: EventRow) => {
    setBusyId(event.event_id);
    const goLive = event.status !== "live";
    const { error } = await setEventLive(event.event_id, goLive);
    setBusyId(null);
    if (error) {
      showToast(error, "error");
      return;
    }
    setEvents((prev) =>
      prev.map((e) => (e.event_id === event.event_id ? { ...e, status: goLive ? "live" : "completed" } : e)),
    );
  };

  const toggleFeedback = async (row: FeedbackRow) => {
    setBusyId(row.poll_id);
    const nextStatus = row.status === "live" ? "locked" : "live";
    const { error } = await setFeedbackStatus(row.poll_id, nextStatus);
    setBusyId(null);
    if (error) {
      showToast(error, "error");
      return;
    }
    setFeedback((prev) => prev.map((f) => (f.poll_id === row.poll_id ? { ...f, status: nextStatus } : f)));
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Live control</h1>
      <p className="mt-1 text-sm text-grey-600">
        Changes here push instantly to every connected attendee via Supabase Realtime.
      </p>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-ink">Agenda events</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {events.map((e) => (
            <li
              key={e.event_id}
              className="flex items-center justify-between rounded-(--radius-card) border border-grey-200 p-3"
            >
              <div>
                <p className="text-sm font-medium text-ink">{e.topic}</p>
                <p className="text-xs text-grey-500">{e.status}</p>
              </div>
              <Button
                size="small"
                variant={e.status === "live" ? "outlined" : "contained"}
                color={e.status === "live" ? "secondary" : "primary"}
                disabled={busyId === e.event_id}
                onClick={() => toggleEvent(e)}
              >
                {e.status === "live" ? "End" : "Go live"}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-ink">Feedback windows</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {feedback.map((f) => (
            <li
              key={f.poll_id}
              className="flex items-center justify-between rounded-(--radius-card) border border-grey-200 p-3"
            >
              <div>
                <p className="text-sm font-medium text-ink">{f.poll_name ?? "Untitled"}</p>
                <p className="text-xs text-grey-500">{f.status}</p>
              </div>
              <Button
                size="small"
                variant={f.status === "live" ? "outlined" : "contained"}
                color={f.status === "live" ? "secondary" : "primary"}
                disabled={busyId === f.poll_id}
                onClick={() => toggleFeedback(f)}
              >
                {f.status === "live" ? "Close" : "Open"}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-ink">Growth Machine session</h2>
        <div className="mt-2 flex items-center justify-between rounded-(--radius-card) border border-grey-200 p-3">
          <div>
            <p className="text-sm font-medium text-ink">
              {liveState?.growth_machine_session_live ? "Unlocked — attendees can join" : "Locked"}
            </p>
            <p className="text-xs text-grey-500">
              /growth-machine shows a locked screen to attendees until this is turned on.
            </p>
          </div>
          <Button
            size="small"
            variant={liveState?.growth_machine_session_live ? "outlined" : "contained"}
            color={liveState?.growth_machine_session_live ? "secondary" : "primary"}
            disabled={gmSessionBusy}
            onClick={toggleGrowthMachineSession}
          >
            {liveState?.growth_machine_session_live ? "Lock" : "Go live"}
          </Button>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-ink">Timers</h2>
        <TimerForm
          title="Growth Machine round timer"
          active={{
            label: liveState?.growth_machine_timer_label ?? null,
            endsAt: liveState?.growth_machine_timer_ends_at ?? null,
          }}
          onStart={async (label, seconds) => {
            const result = await startGrowthMachineTimer(label, seconds);
            if (!result.error) {
              setLiveState((prev) => ({
                ...prev,
                growth_machine_timer_label: label,
                growth_machine_timer_ends_at: new Date(Date.now() + seconds * 1000).toISOString(),
                general_countdown_label: prev?.general_countdown_label ?? null,
                general_countdown_ends_at: prev?.general_countdown_ends_at ?? null,
                growth_machine_session_live: prev?.growth_machine_session_live ?? false,
              }));
            }
            return result;
          }}
          onClear={async () => {
            const result = await clearGrowthMachineTimer();
            if (!result.error) {
              setLiveState((prev) => ({
                ...prev,
                growth_machine_timer_label: null,
                growth_machine_timer_ends_at: null,
                general_countdown_label: prev?.general_countdown_label ?? null,
                general_countdown_ends_at: prev?.general_countdown_ends_at ?? null,
                growth_machine_session_live: prev?.growth_machine_session_live ?? false,
              }));
            }
            return result;
          }}
        />
        <TimerForm
          title="General event countdown"
          active={{
            label: liveState?.general_countdown_label ?? null,
            endsAt: liveState?.general_countdown_ends_at ?? null,
          }}
          onStart={async (label, seconds) => {
            const result = await startGeneralCountdown(label, seconds);
            if (!result.error) {
              setLiveState((prev) => ({
                ...prev,
                general_countdown_label: label,
                general_countdown_ends_at: new Date(Date.now() + seconds * 1000).toISOString(),
                growth_machine_timer_label: prev?.growth_machine_timer_label ?? null,
                growth_machine_timer_ends_at: prev?.growth_machine_timer_ends_at ?? null,
                growth_machine_session_live: prev?.growth_machine_session_live ?? false,
              }));
            }
            return result;
          }}
          onClear={async () => {
            const result = await clearGeneralCountdown();
            if (!result.error) {
              setLiveState((prev) => ({
                ...prev,
                general_countdown_label: null,
                general_countdown_ends_at: null,
                growth_machine_timer_label: prev?.growth_machine_timer_label ?? null,
                growth_machine_timer_ends_at: prev?.growth_machine_timer_ends_at ?? null,
                growth_machine_session_live: prev?.growth_machine_session_live ?? false,
              }));
            }
            return result;
          }}
        />
      </div>
      {toast}
    </div>
  );
}
