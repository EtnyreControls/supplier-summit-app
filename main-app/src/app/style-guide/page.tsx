"use client";
import * as React from "react";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import Radio from "@mui/material/Radio";
import Switch from "@mui/material/Switch";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Skeleton from "@mui/material/Skeleton";
import FormControlLabel from "@mui/material/FormControlLabel";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import {
  PageContainer,
  SectionHeader,
  ListRow,
  TopNav,
  useScrollSpy,
  SessionCard,
  SpeakerCard,
  StatCard,
  QuestionFab,
  AiTag,
  PollCard,
  QuestionCard,
  QrBadge,
  ContactShareList,
  type ShareField,
  Banner,
  EmptyState,
  LabeledProgress,
  useToast,
  useProfileModal,
  FeedbackStepper,
  ModeToggle,
  NavLogo,
} from "@/components";
import { tokens } from "@/theme/theme";
import { useSignOut } from "@/lib/supabase/use-sign-out";

/**
 * Light hex from `tokens` (theme.ts, mirrors globals.css :root); darkHex is
 * the literal from globals.css's .dark block — written out here rather
 * than read live via CSS vars, since the whole point of this table is to
 * show both values side by side regardless of which mode the page is
 * currently in.
 */
const swatches: Array<{ name: string; hex: string; darkHex: string; note?: string }> = [
  { name: "Yellow", hex: tokens.yellow, darkHex: "#E6D600", note: "primary — ink text only" },
  { name: "Yellow hover", hex: tokens.yellowHover, darkHex: "#CCBE00" },
  { name: "Yellow pressed", hex: tokens.yellowPressed, darkHex: tokens.yellowPressed, note: "unchanged in dark mode" },
  { name: "Yellow tint", hex: tokens.yellowTint, darkHex: "#201F1C", note: "banners — matches nav bar shade" },
  { name: "On-yellow", hex: tokens.onYellow, darkHex: tokens.onYellow, note: "content on yellow — never flips" },
  { name: "Ink", hex: tokens.ink, darkHex: "#E2E2E2", note: "text" },
  { name: "Secondary accent", hex: tokens.secondaryAccent, darkHex: "#5A5A60", note: "dark-mode-palette.css — distinct from ink" },
  { name: "Grey 800", hex: tokens.grey[800], darkHex: "#E4E3E6" },
  { name: "Grey 700", hex: tokens.grey[700], darkHex: "#C5C4C8" },
  { name: "Grey 600", hex: tokens.grey[600], darkHex: "#A9A8AC" },
  { name: "Grey 500", hex: tokens.grey[500], darkHex: "#7F7F7F" },
  { name: "Grey 400", hex: tokens.grey[400], darkHex: "#545355", note: "deck grey" },
  { name: "Grey 300", hex: tokens.grey[300], darkHex: "#45454B" },
  { name: "Grey 200", hex: tokens.grey[200], darkHex: "#333338" },
  { name: "Grey 100", hex: tokens.grey[100], darkHex: "#141311" },
  { name: "Grey 50", hex: tokens.grey[50], darkHex: "#201F1C", note: "surfaces" },
  { name: "Amber 900", hex: tokens.amber[900], darkHex: "#E9A057", note: "error text" },
  { name: "Amber 700", hex: tokens.amber[700], darkHex: "#FBA94C" },
  { name: "Amber 500", hex: tokens.amber[500], darkHex: "#D57417", note: "errors / warnings" },
  { name: "Amber 300", hex: tokens.amber[300], darkHex: tokens.amber[300], note: "unchanged in dark mode" },
  { name: "Amber 100", hex: tokens.amber[100], darkHex: "#3B2A14", note: "error backgrounds" },
  { name: "Background", hex: "#FFFFFF", darkHex: "#121212" },
  { name: "Surface", hex: "#FFFFFF", darkHex: "#201F1C", note: "cards, bars, sheets" },
];

export default function StyleGuide() {
  const [tab, setTab] = React.useState(0);
  const inView = useScrollSpy(["about"]);
  const [votedId, setVotedId] = React.useState<string | null>(null);
  const [upvoted, setUpvoted] = React.useState(false);
  const [rating, setRating] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<ShareField[]>([
    { id: "email", label: "Email", value: "sarah.chen@hendrick.com", shared: true },
    { id: "phone", label: "Phone", value: "+1 (570) 555-0148", shared: false },
    { id: "role", label: "Role & company", value: "Account manager, Hendrick Screen", shared: true },
  ]);
  const { toast, showToast } = useToast();
  const handleLogout = useSignOut();
  const { profileModal, openProfile } = useProfileModal();

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav
        activeKey={inView ?? undefined}
        logo={<NavLogo />}
        initials="SC"
        onQrClick={() => showToast("Badge QR opened")}
        onProfile={openProfile}
        onLogout={handleLogout}
      />
      <PageContainer>
        <div id="top" className="mt-2 flex items-center justify-between scroll-mt-16">
          <h1 className="text-2xl font-bold text-ink">Summit UI style guide</h1>
          <ModeToggle />
        </div>
        <p className="mt-1 text-[14px] text-grey-600">
          Etnyre supplier summit — tokens and components. Yellow, ink, grey, and candy-corn amber only.
        </p>

        <SectionHeader
          eyebrow="Foundation"
          title="Color tokens"
          action={<span className="text-[11px] font-semibold uppercase tracking-wide text-grey-500">Light · Dark</span>}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {swatches.map((s) => (
            <div key={s.name} className="overflow-hidden rounded-(--radius-control) border border-grey-200">
              <div className="flex h-12">
                <div className="flex-1" style={{ backgroundColor: s.hex }} />
                <div className="flex-1" style={{ backgroundColor: s.darkHex }} />
              </div>
              <div className="px-2.5 py-1.5">
                <p className="text-[12px] font-semibold text-ink">{s.name}</p>
                <p className="font-mono text-[11px] text-grey-600">
                  {s.hex} <span className="text-grey-400">/</span> {s.darkHex}
                </p>
                {s.note && <p className="text-[11px] text-grey-500">{s.note}</p>}
              </div>
            </div>
          ))}
        </div>

        <SectionHeader eyebrow="Foundation" title="Typography" />
        <div className="flex flex-col gap-1 rounded-(--radius-card) border border-grey-200 p-4">
          <p className="text-2xl font-bold text-ink">Heading 1 — page titles</p>
          <p className="text-lg font-bold text-ink">Heading 2 — sections</p>
          <p className="text-[15px] font-semibold text-ink">Subtitle — card titles</p>
          <p className="text-[15px] text-ink">Body — 15px for primary reading</p>
          <p className="text-[13px] text-grey-600">Body small — metadata, 13px grey-600</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-grey-600">Eyebrow label</p>
        </div>

        <SectionHeader eyebrow="Core" title="Buttons" />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="contained" color="primary">Primary action</Button>
          <Button variant="outlined" color="secondary">Secondary</Button>
          <Button variant="text" color="secondary">Ghost</Button>
          <Button variant="contained" color="primary" disabled>Disabled</Button>
          <Button variant="contained" color="error">Remove contact</Button>
          <IconButton aria-label="My badge QR" className="bg-yellow text-on-yellow hover:bg-yellow-hover">
            <QrCode2Icon />
          </IconButton>
        </div>

        <SectionHeader eyebrow="Core" title="Inputs" />
        <div className="flex flex-col gap-3">
          <TextField label="Company name" placeholder="Hendrick Screen" />
          <TextField label="Your question" multiline minRows={2} placeholder="Type your question for the speaker" />
          <div className="flex flex-wrap items-center gap-4">
            <FormControlLabel control={<Checkbox defaultChecked />} label="Checkbox" />
            <FormControlLabel control={<Radio defaultChecked />} label="Radio" />
            <FormControlLabel control={<Switch defaultChecked />} label="Switch" />
          </div>
        </div>

        <SectionHeader eyebrow="Core" title="Chips & tags" />
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="primary" label="Live now" size="small" />
          <Chip label="Day 1" size="small" />
          <Chip variant="outlined" label="Plant tour" size="small" />
          <AiTag detail="This content was generated by AI from the session transcript." />
          <AiTag label="Grouped by AI" />
        </div>

        <SectionHeader eyebrow="Core" title="Tabs" />
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Day 1" />
          <Tab label="Day 2" />
        </Tabs>

        <SectionHeader eyebrow="Display" title="Cards" />
        <div className="flex flex-col gap-3">
          <SessionCard
            title="Supply chain roadmap keynote"
            time="10:30 – 11:15 AM"
            location="Main hall"
            live
            featured
            onClick={() => showToast("Session details", "info")}
          />
          <SpeakerCard
            name="Justin Nelson"
            role="Executive VP, IT & Supply Chain"
            initials="JN"
            bio="Justin leads IT and supply chain across Etnyre International's three divisions, and is the executive sponsor of this year's supplier summit. Tap to collapse."
          />
          <div className="grid grid-cols-4 gap-2">
            <StatCard value="1,050" label="Members" />
            <StatCard value="6" label="Locations" />
            <StatCard value="3" label="Divisions" />
            <StatCard value="1" label="Purpose" />
          </div>
          <ListRow
            icon={<ForumRoundedIcon />}
            title="Session summaries"
            subtitle="AI-generated recaps of sessions you attended"
            onClick={() => showToast("Opening summaries", "info")}
          />
        </div>

        <SectionHeader eyebrow="Domain" title="Live poll" />
        <PollCard
          question="Which topic should we go deeper on next quarter?"
          live
          votedId={votedId}
          onVote={setVotedId}
          options={[
            { id: "a", label: "Forecast sharing", votes: 18 + (votedId === "a" ? 1 : 0) },
            { id: "b", label: "Quality collaboration", votes: 11 + (votedId === "b" ? 1 : 0) },
            { id: "c", label: "Logistics & freight", votes: 7 + (votedId === "c" ? 1 : 0) },
          ]}
        />

        <SectionHeader eyebrow="Domain" title="Question queue" />
        <QuestionCard
          text="Will forecast data be shared with suppliers on a rolling basis after the summit?"
          votes={upvoted ? 14 : 13}
          upvoted={upvoted}
          onToggleUpvote={() => setUpvoted((u) => !u)}
          groupCount={4}
        />

        <SectionHeader eyebrow="Domain" title="Contact sharing" />
        <div className="flex flex-col gap-4">
          <ContactShareList
            fields={fields}
            onToggle={(id, shared) =>
              setFields((fs) => fs.map((f) => (f.id === id ? { ...f, shared } : f)))
            }
          />
          <QrBadge name="Sarah Chen" company="Hendrick Screen">
            <div className="grid aspect-square w-full place-items-center rounded bg-grey-100 text-xs text-grey-500">
              QR renders here
            </div>
          </QrBadge>
        </div>

        <SectionHeader eyebrow="Domain" title="Feedback stepper" />
        <FeedbackStepper
          steps={[
            "How valuable was today for your partnership with Etnyre?",
            "What should we do differently next year?",
          ]}
          canAdvance={(i) => (i === 0 ? rating !== null : true)}
          onComplete={() => showToast("Feedback submitted — thank you")}
        >
          {(i) =>
            i === 0 ? (
              <div className="flex gap-2">
                {["1", "2", "3", "4", "5"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRating(r)}
                    className={`h-11 w-11 rounded-(--radius-control) border text-[15px] font-semibold transition-colors ${
                      rating === r
                        ? "border-ink bg-yellow text-on-yellow"
                        : "border-grey-300 text-grey-700 hover:border-ink"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            ) : (
              <TextField multiline minRows={3} placeholder="Anything goes — this is anonymous" />
            )
          }
        </FeedbackStepper>

        <SectionHeader eyebrow="Status" title="Progress" />
        <div className="flex flex-col gap-4">
          <LabeledProgress label="Session progress" value={62} valueLabel="25 min left" />
          <div className="flex items-center gap-3">
            <CircularProgress size={22} />
            <span className="text-[13px] text-grey-600">Loading agenda</span>
          </div>
          <Skeleton variant="rounded" height={64} />
        </div>

        <SectionHeader eyebrow="Status" title="Alerts & banners" />
        <div className="flex flex-col gap-2">
          <Banner>Welcome reception starts at 5:30 PM in the main hall</Banner>
          <Alert severity="error">Your badge QR could not be read. Use manual login below.</Alert>
          <Alert severity="warning">Poll closes in 2 minutes.</Alert>
          <Alert severity="success">Contact saved to your connections.</Alert>
          <Alert severity="info">Session summaries appear here after each session ends.</Alert>
        </div>

        <SectionHeader eyebrow="Status" title="Empty state" />
        <EmptyState
          icon={<ForumRoundedIcon sx={{ fontSize: 36 }} />}
          title="No questions yet"
          body="Be the first to ask — the speaker sees the most upvoted questions first."
          action={<Button variant="contained">Ask a question</Button>}
        />
      </PageContainer>

      <QuestionFab
        sessionLabel="Supply chain roadmap keynote"
        onSubmit={() => showToast("Question submitted")}
      />
      {toast}
      {profileModal}
    </div>
  );
}
