"use client";
import * as React from "react";
import Fab from "@mui/material/Fab";
import Zoom from "@mui/material/Zoom";
import Grow from "@mui/material/Grow";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { AiTag } from "./ai-tag";

/** Fixed short list for now — not enforced at the DB level, see the
 * question_anonymity_and_topic migration. */
export const QUESTION_TOPICS = ["General", "Growth Journey", "Growth Machine"] as const;
export type QuestionTopic = (typeof QUESTION_TOPICS)[number];

export interface QuestionSubmission {
  question: string;
  topic: QuestionTopic;
  isAnonymous: boolean;
}

/**
 * Floating action button pinned bottom-right, above the bottom nav.
 * Tap → expands into an anchored card with a textarea and submit.
 * Hide it on screens with a camera viewfinder (pass `hidden`).
 */
export function QuestionFab({
  onSubmit,
  hidden = false,
  sessionLabel,
}: {
  onSubmit: (submission: QuestionSubmission) => void | Promise<void>;
  hidden?: boolean;
  sessionLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [topic, setTopic] = React.useState<QuestionTopic>("General");
  const [isAnonymous, setIsAnonymous] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const close = () => {
    setOpen(false);
    setText("");
    setTopic("General");
    setIsAnonymous(false);
  };

  const submit = async () => {
    const q = text.trim();
    if (!q) return;
    setSending(true);
    try {
      await onSubmit({ question: q, topic, isAnonymous });
      close();
    } finally {
      setSending(false);
    }
  };

  if (hidden) return null;

  return (
    <div
      className="fixed right-4 z-50"
      style={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}
    >
      {open ? (
        <ClickAwayListener onClickAway={close}>
          <Grow in style={{ transformOrigin: "bottom right" }}>
            <div className="w-[min(88vw,340px)] rounded-(--radius-card) border border-grey-200 bg-surface p-4 shadow-[0_10px_30px_rgba(28,28,30,0.18)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[15px] font-semibold text-ink">Ask a question</p>
                <IconButton size="small" aria-label="Close" onClick={close}>
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </div>
              {sessionLabel && (
                <p className="mb-2 text-xs text-grey-600">For: {sessionLabel}</p>
              )}
              <TextField
                multiline
                minRows={3}
                autoFocus
                placeholder="Type your question for the speaker"
                value={text}
                onChange={(e) => setText(e.target.value)}
                sx = {{"& .MuiInputBase-input": {fontSize: 15}}}
              />
              <TextField
                select
                size="small"
                label="Tag"
                value={topic}
                onChange={(e) => setTopic(e.target.value as QuestionTopic)}
                sx={{
                  mt: 2,
                  minWidth: 160,
                  "& .MuiInputBase-input": { fontSize: 13 },
                  "& .MuiInputLabel-root": { fontSize: 13 },
                }}
                slotProps={{ select: { MenuProps: { disablePortal: true } } }}
              >
                {QUESTION_TOPICS.map((t) => (
                  <MenuItem key={t} value={t} sx={{ fontSize: 13 }}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                sx={{ mt: 1, ml: 0 }}
                control={
                  <Switch
                    size="small"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                  />
                }
                label={<span className="text-[13px] text-grey-700">Ask anonymously</span>}
              />
              <div className="mt-3 flex items-center justify-between gap-2">
                <AiTag
                  label="Grouped by AI"
                  detail = "Similar questions from other attendees are grouped together so speakers can answer the most popular ones first"
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={submit}
                  disabled={!text.trim() || sending}
                  sx = {{fontSize: 14}}
                >
                  {sending ? "Sending" : "Submit"}
                </Button>
              </div>
            </div>
          </Grow>
        </ClickAwayListener>
      ) : (
        <Zoom in>
          <Fab
            aria-label="Ask a question"
            onClick={() => setOpen(true)}
            data-tour="question-fab"
            sx={{ width: 64, height: 64 }}
          >
            <QuestionAnswerRoundedIcon sx={{ fontSize: 28 }} />
          </Fab>
        </Zoom>
      )}
    </div>
  );
}