"use client"
import * as React from 'react'
import type { ComponentProps } from 'react'
import {
  Tldraw,
  DefaultStylePanel,
  DefaultToolbar,
  getSnapshot,
  createTLStore,
  loadSnapshot,
  type Editor,
  type TLComponents,
  type TLPageId,
} from 'tldraw'
import {
  createUserId,
  getDefaultUserPresence,
  toRichText,
  UserRecordType,
  type TLInstancePresence,
  type TLStoreSnapshot,
  type TLUserId,
} from '@tldraw/tlschema'
import { useSync } from '@tldraw/sync'
import { atom, type Atom } from '@tldraw/state'
import { inlineBase64AssetStore, type TLCurrentUser, type TLUserPreferences } from '@tldraw/editor'
import 'tldraw/tldraw.css'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded'
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded'
import { useRouter } from 'next/navigation'
import { submitGrowthMachineBoard } from '@/lib/supabase/growth-machine'
import { getLatestGrowthMachineBoardForTable } from '@/lib/supabase/get-growth-machine-board'
import { AsphaltDistributorLoader } from './asphalt-distributor-loader'

/**
 * Base URL of the deployed sync-server Worker (see /sync-server), e.g.
 * "wss://growth-machine-sync.<your-subdomain>.workers.dev" — set once it's
 * deployed (see sync-server/README.md). Sync is simply off (each tab gets
 * its own local, unsynced store, same as before) if this isn't set yet.
 */
const SYNC_SERVER_URL = process.env.NEXT_PUBLIC_TLDRAW_SYNC_URL;

/**
 * tldraw's own panels default to top-right (style panel) and bottom-center
 * (toolbar) via its internal CSS grid — that grid isn't meant to be fought
 * with overrides, so these reposition the DEFAULT panel content inside a
 * plain fixed-position wrapper instead, which is tldraw's documented way to
 * relocate a built-in panel (`components` prop below).
 */
function RepositionedStylePanel(props: ComponentProps<typeof DefaultStylePanel>) {
  return (
    <div
      data-tour="style-panel"
      style={{ position: 'fixed', top: '50%', right: 8, transform: 'translateY(-50%)', pointerEvents: 'all' }}
    >
      <DefaultStylePanel {...props} />
    </div>
  )
}

function RepositionedToolbar(props: ComponentProps<typeof DefaultToolbar>) {
  return (
    <div
      data-tour="toolbar"
      style={{ position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'all' }}
    >
      {/* The Select and Sticky note tools are the two most-used here, so pull
          them to the front of the toolbar (Select first, Sticky right after)
          instead of tldraw's default alphabetical-ish tool order. */}
      <style>{`
        [data-tour="toolbar"] [data-testid="tools.select"] { order: -2; }
        [data-tour="toolbar"] [data-testid="tools.note"] { order: -1; }
      `}</style>
      <DefaultToolbar {...props} />
    </div>
  )
}

// Module-level, not recreated per render — tldraw's `components` prop must
// be a stable reference (it's read once on mount).
const components: TLComponents = {
  StylePanel: RepositionedStylePanel,
  Toolbar: RepositionedToolbar,
}

const PROMPT_HEADINGS = [
  'Engine: What drives growth?\nComplete this sentence: Our Growth Machine will help Etnyre grow by...',
  'Fuel: What information or support is needed?\nComplete this sentence: Etnyre will provide... Suppliers will provide...',
  'Gears: How do we work together?\nComplete this sentence: Together, we will...',
  'Brakes: What slows us down?\nComplete this sentence: Our biggest brake is... We will release the brake by...',
  'Turbo boost: What one big idea could accelerate growth?\nComplete this sentence: Our Turbo Boost idea is... This would accelerate growth by...',
]
const PROMPT_COUNT = PROMPT_HEADINGS.length
// Position/size of each page's locked heading shape — centered on the
// origin so it's a stable, known target for zoomToBounds regardless of
// where the shape actually sits in a given page's coordinate space. Taller
// than a single line of text (h: 110) to fit the "Complete this sentence"
// hint below the heading.
const HEADING_BOUNDS = { x: -350, y: -260, w: 700, h: 160 }

/**
 * Builder-only flow: 5 tldraw pages, one per prompt (see PROMPT_HEADINGS). A
 * top banner steps through them in order — pages are truly isolated stores
 * under the hood, so "only editable in this prompt" is enforced by tldraw
 * itself (switching pages), not by any custom bounds-checking code.
 *
 * Each page is pre-filled with its heading as a locked geo shape
 * (isLocked: true) — visible and part of the canvas/exports, but the
 * Builder can't select, move, or edit it, only draw around it.
 *
 * Review renders each page as a static image, generated directly from the
 * live editor via `editor.toImage()` — not tldraw's <TldrawImage>, which
 * reconstructs a whole separate store from a snapshot and was rendering
 * blank for reasons that weren't worth chasing further when calling
 * toImage() on the editor we already know has the shapes is simpler and
 * more reliable.
 */
function BuilderFlow({
  editor,
  roomId,
  builderStatus,
}: {
  editor: Editor;
  roomId: string;
  builderStatus: Atom<'editing' | 'review' | 'submitted'>;
}) {
  const [pageIds, setPageIds] = React.useState<TLPageId[] | null>(null);
  const [index, setIndex] = React.useState(0);
  const [mode, setMode] = React.useState<'editing' | 'review' | 'submitted'>('editing');

  // Broadcast to Spectators via presence (see SyncedGrowthMachineCanvas's
  // getUserPresence, which reads this atom) — SpectatorBuilderStatusWatcher
  // toasts on 'review' and shows the forced-exit notice on 'submitted'.
  React.useEffect(() => {
    builderStatus.set(mode);
  }, [mode, builderStatus]);
  // True while editing a single prompt reached via the "Edit" action on the
  // review screen (or after submitting) — shows a "Done editing" button in
  // the prompt bar so the builder can jump straight back to review instead
  // of arrowing through the remaining prompts.
  const [cameFromReview, setCameFromReview] = React.useState(false);
  const [thumbnails, setThumbnails] = React.useState<Record<string, string>>({});
  const [generating, setGenerating] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const setupRan = React.useRef(false);
  // Briefly true on mount while checking for a prior submission, so a
  // returning Builder doesn't flash the blank editing flow before landing
  // on the submitted screen below.
  const [checkingSubmission, setCheckingSubmission] = React.useState(true);

  React.useEffect(() => {
    if (setupRan.current) return;
    setupRan.current = true;

    const existing = editor.getPages();
    for (let i = 0; i < PROMPT_COUNT; i++) {
      const label = `Prompt ${i + 1}`;
      if (existing[i]) {
        if (existing[i].name !== label) editor.renamePage(existing[i].id, label);
      } else {
        editor.createPage({ name: label });
      }
    }
    const ids = editor.getPages().slice(0, PROMPT_COUNT).map((p) => p.id);

    editor.createShapes(
      ids.map((pageId, i) => ({
        type: 'geo' as const,
        parentId: pageId,
        x: HEADING_BOUNDS.x,
        y: HEADING_BOUNDS.y,
        isLocked: true,
        props: {
          geo: 'rectangle' as const,
          w: HEADING_BOUNDS.w,
          h: HEADING_BOUNDS.h,
          dash: 'solid' as const,
          fill: 'none' as const,
          color: 'black' as const,
          size: 'l' as const,
          align: 'middle' as const,
          verticalAlign: 'middle' as const,
          richText: toRichText(PROMPT_HEADINGS[i]),
        },
      }))
    );

    setPageIds(ids);
    editor.setCurrentPage(ids[0]);
    // A fresh page's default camera doesn't necessarily center the origin
    // in the viewport (it can leave world (0,0) at the viewport's corner),
    // so the heading — placed at negative coordinates to sit centered
    // around the origin — was landing outside the visible area. Snap
    // (no animation) to frame it on every page, not just the first.
    editor.zoomToBounds(HEADING_BOUNDS, { inset: 200, targetZoom: 1 });

    // A Builder revisiting an already-submitted table (e.g. via the "Edit
    // board" action on /growth-machine once role-picking is skipped for a
    // submitted table) should land on the submitted screen, not the blank
    // editing flow they'd otherwise start on.
    getLatestGrowthMachineBoardForTable(roomId)
      .then(({ snapshot }) => {
        if (snapshot) setMode('submitted');
      })
      .finally(() => setCheckingSubmission(false));
  }, [editor, roomId]);

  React.useEffect(() => {
    return () => {
      Object.values(thumbnails).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!pageIds || checkingSubmission) return <AsphaltDistributorLoader label="Loading board" />;

  const goToPage = (i: number) => {
    editor.setCurrentPage(pageIds[i]);
    setIndex(i);
    // Each page has its own independent camera — without this, only the
    // first page (framed during setup) would reliably show its heading.
    editor.zoomToBounds(HEADING_BOUNDS, { inset: 200, targetZoom: 1 });
  };

  const enterReview = async () => {
    setCameFromReview(false);
    setGenerating(true);
    const entries = await Promise.all(
      pageIds.map(async (id) => {
        const shapeIds = [...editor.getPageShapeIds(id)];
        // Every page always has at least the locked heading shape — "empty"
        // means nothing else has been drawn, not literally zero shapes.
        const hasDrawing = shapeIds.some((sid) => !editor.getShape(sid)?.isLocked);
        if (!hasDrawing) return [id, null] as const;
        const result = await editor.toImage(shapeIds, { format: 'png', background: true });
        return [id, result ? URL.createObjectURL(result.blob) : null] as const;
      })
    );
    Object.values(thumbnails).forEach((url) => URL.revokeObjectURL(url));
    const next: Record<string, string> = {};
    for (const [id, url] of entries) {
      if (url) next[id] = url;
    }
    setThumbnails(next);
    setGenerating(false);
    setMode('review');
  };

  // Sends the whole tldraw document (all 5 prompt pages) to Supabase —
  // growth_machine_boards, builder-only per its RPC. The snapshot's
  // `document` half is the shared drawing; `session` (camera, selections)
  // is per-user noise and deliberately left out.
  const submitBoard = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const { document } = getSnapshot(editor.store);
    // The board submission can hang indefinitely if the request never gets
    // a response (e.g. a dropped connection) — a timeout keeps the button
    // from being stuck on "Submitting…" forever.
    const timeout = new Promise<{ error: string }>((resolve) =>
      setTimeout(() => resolve({ error: "Submission timed out. Please try again." }), 20000)
    );
    const { error } = await Promise.race([submitGrowthMachineBoard(roomId, document), timeout]);
    setSubmitting(false);
    if (error) {
      setSubmitError(error);
      return;
    }
    setMode('submitted');
  };

  if (mode === 'submitted') {
    return (
      <div className="pointer-events-auto fixed inset-0 z-[500] flex flex-col items-center justify-center bg-background p-6">
        <h1 className="text-center text-xl font-bold text-ink">Board submitted</h1>
        <p className="mt-1 text-center text-sm text-grey-600">
          Your table&apos;s board is saved — thanks for building!
        </p>
        <Button className="mt-5" variant="outlined" color="secondary" onClick={() => setMode('review')}>
          View or edit submission
        </Button>
      </div>
    );
  }

  if (mode === 'review') {
    const allFilled = pageIds.every((id) => thumbnails[id]);
    return (
      <div className="pointer-events-auto fixed inset-0 z-[500] flex flex-col items-center justify-center overflow-auto bg-background p-6">
        <h1 className="text-center text-xl font-bold text-ink">Review your board</h1>
        <p className="mt-1 text-center text-sm text-grey-600">
          All 5 prompts, side by side — submit when you&apos;re happy with them.
        </p>
        <div className="mx-auto mt-6 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {pageIds.map((id, i) => (
            <div key={id} className="flex flex-col items-center gap-2">
              <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-(--radius-card) border border-grey-200 bg-surface">
                {thumbnails[id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnails[id]} alt={`Prompt ${i + 1}`} className="h-full w-full object-contain" />
                ) : (
                  <p className="px-3 text-center text-xs text-grey-500">Nothing drawn yet</p>
                )}
              </div>
              <p className="text-xs font-semibold text-ink">Prompt {i + 1}</p>
              <Button
                size="small"
                variant="text"
                color="secondary"
                onClick={() => {
                  setMode('editing');
                  setCameFromReview(true);
                  goToPage(i);
                }}
              >
                Edit
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col items-center gap-2">
          {!allFilled && (
            <p className="text-xs text-grey-500">Every prompt needs a drawing before you can submit.</p>
          )}
          {submitError && <p className="text-xs text-amber-700">{submitError}</p>}
          <Button
            variant="contained"
            color="primary"
            disabled={!allFilled || submitting}
            onClick={submitBoard}
          >
            {submitting ? 'Submitting…' : 'Submit board'}
          </Button>
        </div>
      </div>
    );
  }

  const isLast = index === PROMPT_COUNT - 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 z-[400] flex justify-center" style={{ top: 64 }}>
      <div
        data-tour="prompt-banner"
        className="pointer-events-auto flex items-center gap-3 rounded-(--radius-card) px-4 py-2 shadow-lg"
        // Always black — the prompt bar needs to read the same regardless of
        // the builder's light/dark mode preference, so it's pinned rather
        // than using the theme's (mode-dependent) surface/ink tokens.
        style={{ backgroundColor: '#000' }}
      >
        <IconButton
          size="small"
          aria-label="Previous prompt"
          disabled={index === 0}
          onClick={() => goToPage(index - 1)}
          sx={{ color: '#fff' }}
        >
          <ArrowBackIosNewRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <span className="whitespace-nowrap text-sm font-medium text-white">
          Prompt {index + 1} of {PROMPT_COUNT}
        </span>
        <IconButton
          size="small"
          aria-label="Next prompt"
          disabled={isLast}
          onClick={() => goToPage(index + 1)}
          sx={{ color: '#fff' }}
        >
          <ArrowForwardIosRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
        {cameFromReview ? (
          <Button size="small" variant="contained" color="primary" disabled={generating} onClick={enterReview}>
            {generating ? 'Saving…' : 'Done editing'}
          </Button>
        ) : (
          isLast && (
            <Button size="small" variant="contained" color="primary" disabled={generating} onClick={enterReview}>
              {generating ? 'Preparing…' : 'Submit'}
            </Button>
          )
        )}
      </div>
    </div>
  );
}

/**
 * Spectator-only: lets Spectators step through the same 5 prompt pages the
 * Builder set up (BuilderFlow creates them; Spectators never do), without
 * any of BuilderFlow's editing/review/submit machinery. Each Spectator's
 * current page and camera are local to their own session (never synced —
 * same as the Builder's), so browsing here never moves anyone else's view.
 *
 * The prompt pages may not exist yet (e.g. a Spectator connects before the
 * Builder has picked a role) — in that case this renders nothing until they
 * arrive, then frames page 1 as soon as they do.
 */
function SpectatorPromptNav({ editor }: { editor: Editor }) {
  const [pageIds, setPageIds] = React.useState<TLPageId[] | null>(null);
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const checkPages = () => {
      const pages = editor.getPages();
      if (pages.length < PROMPT_COUNT) return false;
      setPageIds(pages.slice(0, PROMPT_COUNT).map((p) => p.id));
      return true;
    };
    if (checkPages()) return;
    const unlisten = editor.store.listen(() => {
      checkPages();
    });
    return unlisten;
  }, [editor]);

  const goToPage = React.useCallback(
    (i: number, ids: TLPageId[]) => {
      editor.setCurrentPage(ids[i]);
      setIndex(i);
      // Same framing BuilderFlow uses — each page has its own independent
      // camera, so this needs to run on every page switch, not just once.
      editor.zoomToBounds(HEADING_BOUNDS, { inset: 200, targetZoom: 1 });
    },
    [editor]
  );

  // Frame page 1 as soon as the prompt pages become available.
  React.useEffect(() => {
    if (pageIds) goToPage(0, pageIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIds]);

  if (!pageIds) return null;
  const isLast = index === PROMPT_COUNT - 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 z-[400] flex justify-center" style={{ top: 64 }}>
      <div
        className="pointer-events-auto flex items-center gap-3 rounded-(--radius-card) px-4 py-2 shadow-lg"
        style={{ backgroundColor: '#000' }}
      >
        <IconButton
          size="small"
          aria-label="Previous prompt"
          disabled={index === 0}
          onClick={() => goToPage(index - 1, pageIds)}
          sx={{ color: '#fff' }}
        >
          <ArrowBackIosNewRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <span className="whitespace-nowrap text-sm font-medium text-white">
          Prompt {index + 1} of {PROMPT_COUNT}
        </span>
        <IconButton
          size="small"
          aria-label="Next prompt"
          disabled={isLast}
          onClick={() => goToPage(index + 1, pageIds)}
          sx={{ color: '#fff' }}
        >
          <ArrowForwardIosRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </div>
    </div>
  );
}

/**
 * Lets a Spectator snap their camera + page to whatever the Builder
 * currently has open, and keep following live as the Builder moves —
 * tldraw's own `startFollowingUser`/`stopFollowingUser` do the actual
 * camera/page syncing (built for exactly this), so this component's job is
 * just finding the Builder's session and toggling it.
 *
 * The Builder's `userId` isn't fixed (a fresh random one is generated per
 * mount — see useEphemeralPresenceUser), so this looks for whichever
 * connected peer's presence is tagged `meta.role === 'builder'`
 * (SyncedGrowthMachineCanvas's getUserPresence) rather than a hardcoded id
 * — keeps working across reconnects/seat changes without extra plumbing.
 *
 * Manual navigation already cancels following on its own: tldraw's
 * `editor.setCurrentPage` (what SpectatorPromptNav's goToPage calls) and
 * manual panning/zooming both call `stopFollowingUser` internally, so this
 * button's "Following" state can just mirror `editor.getInstanceState()`
 * rather than tracking its own on/off flag.
 */
function FollowBuilderToggle({ editor }: { editor: Editor }) {
  const [builderUserId, setBuilderUserId] = React.useState<TLUserId | null>(null);
  const [isFollowing, setIsFollowing] = React.useState(false);

  React.useEffect(() => {
    const sync = () => {
      const presences = editor.store.query.records('instance_presence').get() as TLInstancePresence[];
      const builder = presences.find((p) => (p.meta as { role?: string }).role === 'builder');
      setBuilderUserId(builder?.userId ?? null);
      setIsFollowing(builder != null && editor.getInstanceState().followingUserId === builder.userId);
    };
    sync();
    // Presence changes (Builder connects/disconnects/moves) come in on the
    // 'presence' scope; our own click below also needs the instance-state
    // change to be picked up, which is 'session' scope — listen to both.
    const unlistenPresence = editor.store.listen(sync, { scope: 'presence', source: 'all' });
    const unlistenSession = editor.store.listen(sync, { scope: 'session', source: 'all' });
    return () => {
      unlistenPresence();
      unlistenSession();
    };
  }, [editor]);

  if (!builderUserId) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 z-[400] flex justify-center" style={{ top: 116 }}>
      <Button
        variant="contained"
        size="small"
        className="pointer-events-auto"
        onClick={() => {
          if (isFollowing) {
            editor.stopFollowingUser();
          } else {
            editor.startFollowingUser(builderUserId);
          }
        }}
        sx={{
          bgcolor: isFollowing ? '#fff' : '#000',
          color: isFollowing ? '#000' : '#fff',
          '&:hover': { bgcolor: isFollowing ? '#fff' : '#000' },
        }}
      >
        {isFollowing ? 'Following builder' : 'Follow builder'}
      </Button>
    </div>
  );
}

/**
 * Notifies Spectators of the Builder's review/submit state — read off the
 * Builder's own presence (`meta.builderStatus`, kept in sync by BuilderFlow
 * via SyncedGrowthMachineCanvas's getUserPresence; see the comments there).
 *
 * While the Builder is reviewing, a persistent banner stays up for as long
 * as that's true (not a toast — this is ongoing state, not a one-off
 * event, so it shouldn't disappear on its own while still accurate).
 *
 * Once submitted, there's nothing left to watch live, so this swaps to the
 * actual submitted board — the same read-only GrowthMachineBoardViewer
 * analytics uses — fetched via getLatestGrowthMachineBoardForTable, which
 * RLS permits for any table member, not just the Builder.
 */
function SpectatorBuilderStatusWatcher({ editor, roomId }: { editor: Editor; roomId: string }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<string | undefined>(undefined);
  const [submittedSnapshot, setSubmittedSnapshot] = React.useState<unknown | null>(null);
  const [snapshotError, setSnapshotError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const check = () => {
      const presences = editor.store.query.records('instance_presence').get() as TLInstancePresence[];
      const builder = presences.find((p) => (p.meta as { role?: string })?.role === 'builder');
      setStatus((builder?.meta as { builderStatus?: string } | undefined)?.builderStatus);
    };
    check();
    return editor.store.listen(check, { scope: 'presence', source: 'all' });
  }, [editor]);

  React.useEffect(() => {
    if (status !== 'submitted') return;
    let cancelled = false;
    getLatestGrowthMachineBoardForTable(roomId).then(({ snapshot, error }) => {
      if (cancelled) return;
      if (error) setSnapshotError(error);
      else setSubmittedSnapshot(snapshot);
    });
    return () => {
      cancelled = true;
    };
  }, [status, roomId]);

  if (status === 'submitted') {
    if (submittedSnapshot) {
      return (
        <GrowthMachineBoardViewer snapshot={submittedSnapshot} onClose={() => router.push('/growth-machine')} />
      );
    }
    return (
      <div className="pointer-events-auto fixed inset-0 z-[600] flex flex-col items-center justify-center bg-background p-6 text-center">
        <h1 className="text-xl font-bold text-ink">Board submitted</h1>
        <p className="mt-1 text-sm text-grey-600">
          {snapshotError ?? 'Loading the submitted board…'}
        </p>
        {snapshotError && (
          <Button
            className="mt-4"
            variant="contained"
            color="primary"
            sx={{ bgcolor: '#000', color: '#fff' }}
            onClick={() => router.push('/growth-machine')}
          >
            Leave board
          </Button>
        )}
      </div>
    );
  }

  if (status !== 'review') return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[400] flex justify-center" style={{ top: 168 }}>
      <div
        className="pointer-events-auto rounded-(--radius-card) px-4 py-2 text-sm font-medium text-white shadow-lg"
        style={{ backgroundColor: '#000' }}
      >
        The builder is reviewing the board
      </div>
    </div>
  );
}

/**
 * Shared collaborative canvas for /growth-machine/board. `readOnly` is set
 * once on mount via `editor.updateInstanceState` — tldraw's documented way
 * to put the editor in view-only mode (no shape creation/editing, no
 * toolbar actions), used for Spectators so only the Builder can draw.
 * `hideUi` also hides the (repositioned) panels entirely for Spectators.
 * BuilderFlow (the 5-prompt stepper + review) only mounts when NOT readOnly;
 * Spectators get SpectatorPromptNav instead — a lighter version that lets
 * them step through the same 5 prompt pages independently (own camera, own
 * current page — tldraw's `currentPageId`/camera are per-session instance
 * state, never synced, so each Spectator browsing on their own doesn't
 * affect the Builder or other Spectators). Spectators can also scribble with
 * tldraw's built-in Laser tool — a trail drawn via `editor.scribbles`, not
 * real shapes, so it auto-fades and never touches the document store (works
 * even under isReadonly, which blocks every shape-mutating method but not
 * scribbles). Locked on as their only tool since `hideUi` hides the toolbar
 * they'd otherwise use to switch tools — SpectatorPromptNav's prev/next
 * buttons are the only way for them to move between prompts.
 *
 * Synced via the sync-server Worker (see /sync-server) when
 * NEXT_PUBLIC_TLDRAW_SYNC_URL is set — one room per `roomId` (currently the
 * table id, see /growth-machine/board), so Builder and Spectators at the
 * same table share a live document instead of each getting their own
 * isolated local store. Falls back to a local, unsynced store (today's
 * behavior) if that env var isn't configured yet.
 */
export function GrowthMachine({
  readOnly = false,
  roomId = 'default',
}: {
  readOnly?: boolean;
  roomId?: string;
}) {
  if (SYNC_SERVER_URL) {
    return <SyncedGrowthMachineCanvas readOnly={readOnly} roomId={roomId} syncServerUrl={SYNC_SERVER_URL} />;
  }
  return <GrowthMachineCanvas readOnly={readOnly} roomId={roomId} />;
}

// Same palette tldraw's own default (anonymous, localStorage-backed) user
// preferences pick from — kept here only so a random per-session color still
// looks like a normal tldraw collaborator color.
const PRESENCE_COLORS = [
  '#FF802B', '#F2555A', '#F04F88', '#E34BA9', '#BD54C6',
  '#9D5BD2', '#7B66DC', '#02B1CC', '#11B3A3', '#39B178', '#55B467',
] as const;

/**
 * tldraw's `useSync` defaults to an anonymous identity cached in
 * localStorage (see @tldraw/editor's defaultUserStore/getUserPreferences).
 * localStorage is shared by every tab in the same browser profile —
 * including multiple tabs within one Incognito session — so a Builder and
 * Spectator tested in two tabs of the same profile end up with the *same*
 * userId. tldraw's collaborator rendering filters out presence records
 * whose userId matches your own (it assumes that's always "you"), so their
 * cursors/scribbles silently never render for each other even though the
 * presence data really is being broadcast correctly.
 *
 * Building a fresh identity per mount (not persisted anywhere) sidesteps
 * this: every browser tab gets its own id regardless of what's sharing
 * localStorage with it.
 *
 * There are actually *two* separate "who am I" concepts in tldraw, and both
 * need to agree for FollowBuilderToggle to work:
 *  - `useSync`'s `users` option controls the identity broadcast in presence
 *    records (`instance_presence.userId`) — fixed above.
 *  - `<Tldraw>`'s own `user` prop (`editor.user`) is a *separate* identity,
 *    used internally by `getCollaborators()`/`startFollowingUser()` to
 *    exclude "yourself" from the peer list. Left unset, it falls back to
 *    the exact same shared-localStorage default this whole hook exists to
 *    avoid — so without also overriding it, the editor's self-concept and
 *    its own broadcast identity disagree, which is enough to make
 *    `startFollowingUser` fail to resolve a peer correctly.
 * Both are built from the same random id here so there's only one identity
 * per tab, not two that happen to usually not matter.
 */
function useEphemeralPresenceUser() {
  const identity = React.useState(() => ({
    id: createUserId(crypto.randomUUID()),
    color: PRESENCE_COLORS[Math.floor(Math.random() * PRESENCE_COLORS.length)],
  }))[0];

  const users = React.useState(() => ({
    currentUser: atom(
      'growth-machine-presence-user',
      UserRecordType.create({ id: identity.id, name: '', color: identity.color })
    ),
  }))[0];

  // Deliberately not tldraw's real setUserPreferences (which writes to the
  // same shared localStorage this hook exists to avoid, and broadcasts
  // across tabs via BroadcastChannel) — just keeps preference toggles (e.g.
  // dark mode from the Builder's menu) reactive within this tab, without
  // persisting or leaking the id back out.
  const prefsAtom = React.useState(() =>
    atom<TLUserPreferences>('growth-machine-user-prefs', { id: identity.id, color: identity.color })
  )[0];
  const tlUser = React.useState<TLCurrentUser>(() => ({
    userPreferences: prefsAtom,
    setUserPreferences: (prefs) => prefsAtom.set(prefs),
  }))[0];

  return { users, tlUser };
}

function SyncedGrowthMachineCanvas({
  readOnly,
  roomId,
  syncServerUrl,
}: {
  readOnly: boolean;
  roomId: string;
  syncServerUrl: string;
}) {
  const { users, tlUser } = useEphemeralPresenceUser();
  // Builder-only; read inside getUserPresence below so changes broadcast
  // automatically (presence is a reactive derivation — any signal read
  // during it becomes a dependency, same mechanism as scribbles/cursor).
  // Mirrors BuilderFlow's own `mode` state — see the effect there that
  // keeps this in sync — so Spectators can react to review/submit without
  // a dedicated message protocol.
  const builderStatus = React.useState(() =>
    atom<'editing' | 'review' | 'submitted'>('growth-machine-builder-status', 'editing')
  )[0];
  // No upload backend wired up yet (deliberately out of scope — see
  // sync-server/README.md), so pasted images/videos are inlined as base64
  // rather than uploaded. Fine for this board's actual usage (drawings and
  // locked heading shapes), not recommended if large media becomes common.
  const store = useSync({
    uri: `${syncServerUrl}/api/connect/${roomId}`,
    assets: inlineBase64AssetStore,
    users,
    // Tags every presence record with its role so FollowBuilderToggle can
    // pick the Builder's session out of the room's connected peers — role
    // isn't otherwise derivable from presence data (it's a client-side-only
    // concept, see GrowthMachineCanvas's isReadonly), and the userId itself
    // is random per session (see useEphemeralPresenceUser) so it can't be
    // hardcoded either. Builder's presence additionally carries its review/
    // submit status for SpectatorBuilderStatusWatcher.
    getUserPresence: (s, user) => {
      const base = getDefaultUserPresence(s, user);
      if (!base) return null;
      return {
        ...base,
        meta: readOnly ? { role: 'spectator' } : { role: 'builder', builderStatus: builderStatus.get() },
      };
    },
  });

  if (store.status === 'loading') {
    return <AsphaltDistributorLoader label="Connecting to board" />;
  }
  if (store.status === 'error') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background p-6 text-center">
        <p className="text-sm text-grey-600">Couldn&apos;t connect to the board. Refresh to try again.</p>
      </div>
    );
  }
  // status is 'synced-remote' from here, but connectionStatus can still drop
  // to 'offline' later (dropped/slow network) while the socket quietly
  // retries underneath — same loader rather than leaving a frozen,
  // unexplained canvas on screen while that happens.
  if (store.connectionStatus === 'offline') {
    return <AsphaltDistributorLoader label="Reconnecting" />;
  }

  return (
    <GrowthMachineCanvas
      readOnly={readOnly}
      roomId={roomId}
      store={store}
      user={tlUser}
      builderStatus={builderStatus}
    />
  );
}

function GrowthMachineCanvas({
  readOnly,
  roomId,
  store,
  user,
  builderStatus,
}: {
  readOnly: boolean;
  roomId: string;
  store?: ReturnType<typeof useSync>;
  user?: TLCurrentUser;
  builderStatus?: Atom<'editing' | 'review' | 'submitted'>;
}) {
  const [editor, setEditor] = React.useState<Editor | null>(null);
  // Falls back to a local-only atom when unsynced (SYNC_SERVER_URL unset) —
  // BuilderFlow always has something to write to, it just goes nowhere.
  const localBuilderStatus = React.useState(() =>
    atom<'editing' | 'review' | 'submitted'>('growth-machine-builder-status-local', 'editing')
  )[0];
  const resolvedBuilderStatus = builderStatus ?? localBuilderStatus;

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        store={store}
        user={user}
        hideUi={readOnly}
        components={components}
        onMount={(ed: Editor) => {
          ed.updateInstanceState({ isReadonly: readOnly });
          // Spectators are locked to the Laser (their only usable tool,
          // since hideUi hides the toolbar). Builders default to Sticky note
          // rather than Select, since that's the primary way of adding
          // ideas to the board.
          ed.setCurrentTool(readOnly ? 'laser' : 'note');
          setEditor(ed);
        }}
      />
      {!readOnly && editor && (
        <BuilderFlow editor={editor} roomId={roomId} builderStatus={resolvedBuilderStatus} />
      )}
      {readOnly && editor && <SpectatorPromptNav editor={editor} />}
      {readOnly && editor && <FollowBuilderToggle editor={editor} />}
      {readOnly && editor && <SpectatorBuilderStatusWatcher editor={editor} roomId={roomId} />}
    </div>
  );
}

/**
 * Read-only browser for a submitted board (growth_machine_boards.snapshot —
 * used by both analytics and SpectatorBuilderStatusWatcher's post-submit
 * view). Loads the stored document into a fresh local-only store via
 * tldraw's loadSnapshot — no sync-server connection, since this is browsing
 * a finished submission, not the live room. Only `document` was ever stored
 * (see submitBoard above), so `session` (camera/selection) is left for
 * tldraw to default.
 *
 * Mirrors BuilderFlow's own review screen rather than exposing tldraw's
 * default UI (which would let you page-switch/pan/zoom freely — fine for
 * editing, not what a *finished* board should look like browsing it after
 * the fact): a grid of the 5 prompt thumbnails first, and clicking one
 * opens a static, single-page view with the same prev/next prompt bar
 * Spectators already use live (SpectatorPromptNav) — never the full tldraw
 * toolbar/page-menu, since this is a snapshot, not something to edit.
 */
export function GrowthMachineBoardViewer({
  snapshot,
  onClose,
  editHref,
}: {
  snapshot: unknown;
  // Optional — when this viewer replaces the role picker entirely (a
  // table that's already submitted, see /growth-machine's page.tsx),
  // there's nothing to "close" back to.
  onClose?: () => void;
  // Shows an additional "Edit board" action alongside Close — only the
  // current Builder should get this (checked by the caller), so it's
  // opt-in rather than this component re-deriving that itself.
  editHref?: string;
}) {
  const router = useRouter();
  const [store] = React.useState(() => {
    const s = createTLStore();
    loadSnapshot(s, { document: snapshot as TLStoreSnapshot });
    return s;
  });
  const [editor, setEditor] = React.useState<Editor | null>(null);
  const [pageIds, setPageIds] = React.useState<TLPageId[] | null>(null);
  const [thumbnails, setThumbnails] = React.useState<Record<string, string>>({});
  // null = grid view; otherwise the index of the prompt being browsed.
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);

  // Same thumbnail-generation approach as BuilderFlow's enterReview — runs
  // once the (hidden) editor mounts, so the grid has something to show
  // before the viewer is ever opened into single-page mode.
  React.useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    (async () => {
      const ids = editor.getPages().slice(0, PROMPT_COUNT).map((p) => p.id);
      const entries = await Promise.all(
        ids.map(async (id) => {
          const shapeIds = [...editor.getPageShapeIds(id)];
          const hasDrawing = shapeIds.some((sid) => !editor.getShape(sid)?.isLocked);
          if (!hasDrawing) return [id, null] as const;
          const result = await editor.toImage(shapeIds, { format: 'png', background: true });
          return [id, result ? URL.createObjectURL(result.blob) : null] as const;
        })
      );
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [id, url] of entries) if (url) next[id] = url;
      setThumbnails(next);
      setPageIds(ids);
    })();
    return () => {
      cancelled = true;
    };
  }, [editor]);

  React.useEffect(() => {
    return () => {
      Object.values(thumbnails).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToPage = (i: number) => {
    if (!editor || !pageIds) return;
    editor.setCurrentPage(pageIds[i]);
    // Same framing BuilderFlow/SpectatorPromptNav use — each page has its
    // own independent camera.
    editor.zoomToBounds(HEADING_BOUNDS, { inset: 200, targetZoom: 1 });
    setSelectedIndex(i);
  };

  return (
    <div className="fixed inset-0 z-[600] bg-background">
      {/* Always mounted (so the editor exists to generate thumbnails and
          can be framed instantly on selection) but only actually shown in
          single-page mode — the grid is a separate overlay on top. */}
      <div style={{ position: 'fixed', inset: 0, visibility: selectedIndex === null ? 'hidden' : 'visible' }}>
        <Tldraw
          store={store}
          hideUi
          onMount={(ed: Editor) => {
            ed.updateInstanceState({ isReadonly: true });
            setEditor(ed);
          }}
        />
      </div>

      {selectedIndex !== null && (
        <div className="pointer-events-none fixed inset-x-0 z-[610] flex justify-center" style={{ top: 64 }}>
          <div
            className="pointer-events-auto flex items-center gap-3 rounded-(--radius-card) px-4 py-2 shadow-lg"
            style={{ backgroundColor: '#000' }}
          >
            <IconButton
              size="small"
              aria-label="Previous prompt"
              disabled={selectedIndex === 0}
              onClick={() => goToPage(selectedIndex - 1)}
              sx={{ color: '#fff' }}
            >
              <ArrowBackIosNewRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
            <span className="whitespace-nowrap text-sm font-medium text-white">
              Prompt {selectedIndex + 1} of {PROMPT_COUNT}
            </span>
            <IconButton
              size="small"
              aria-label="Next prompt"
              disabled={selectedIndex === PROMPT_COUNT - 1}
              onClick={() => goToPage(selectedIndex + 1)}
              sx={{ color: '#fff' }}
            >
              <ArrowForwardIosRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 top-0 z-[610] flex items-center justify-between p-3">
        {selectedIndex !== null ? (
          <Button
            variant="outlined"
            className="pointer-events-auto"
            onClick={() => setSelectedIndex(null)}
            sx={{ bgcolor: '#fff' }}
          >
            Back to all prompts
          </Button>
        ) : (
          <span />
        )}
        <div className="pointer-events-auto flex gap-2">
          {editHref && (
            <Button
              variant="contained"
              onClick={() => router.push(editHref)}
              sx={{ bgcolor: '#000', color: '#fff' }}
            >
              Edit board
            </Button>
          )}
          {onClose && (
            <Button variant="contained" onClick={onClose} sx={{ bgcolor: '#000', color: '#fff' }}>
              Close
            </Button>
          )}
        </div>
      </div>

      {selectedIndex === null && (
        <div className="fixed inset-0 overflow-auto p-6 pt-20">
          <h1 className="text-center text-xl font-bold text-ink">Submitted board</h1>
          <p className="mt-1 text-center text-sm text-grey-600">All 5 prompts — tap one to view it full-size.</p>
          {pageIds ? (
            <div className="mx-auto mt-6 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {pageIds.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => goToPage(i)}
                  className="flex flex-col items-center gap-2 text-left"
                >
                  <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-(--radius-card) border border-grey-200 bg-surface">
                    {thumbnails[id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbnails[id]} alt={`Prompt ${i + 1}`} className="h-full w-full object-contain" />
                    ) : (
                      <p className="px-3 text-center text-xs text-grey-500">Nothing drawn</p>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-ink">Prompt {i + 1}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-10 flex justify-center">
              <AsphaltDistributorLoader label="Loading submission" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
