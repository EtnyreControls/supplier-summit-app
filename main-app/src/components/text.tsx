"use client"
import * as React from 'react'
import type { ComponentProps } from 'react'
import { Tldraw, DefaultStylePanel, DefaultToolbar, getSnapshot, type Editor, type TLComponents, type TLPageId } from 'tldraw'
import { toRichText } from '@tldraw/tlschema'
import { useSync } from '@tldraw/sync'
import { inlineBase64AssetStore } from '@tldraw/editor'
import 'tldraw/tldraw.css'
import Button from '@mui/material/Button'
import { submitGrowthMachineBoard } from '@/lib/supabase/growth-machine'

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
  'Engine: What drives growth?',
  'Fuel: What information or support is needed?',
  'Gears: How do we work together?',
  'Brakes: What slows us down?',
  'Turbo boost: What one big idea could accelerate growth?',
]
const PROMPT_COUNT = PROMPT_HEADINGS.length
// Position/size of each page's locked heading shape — centered on the
// origin so it's a stable, known target for zoomToBounds regardless of
// where the shape actually sits in a given page's coordinate space.
const HEADING_BOUNDS = { x: -350, y: -260, w: 700, h: 110 }

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
function BuilderFlow({ editor, roomId }: { editor: Editor; roomId: string }) {
  const [pageIds, setPageIds] = React.useState<TLPageId[] | null>(null);
  const [index, setIndex] = React.useState(0);
  const [mode, setMode] = React.useState<'editing' | 'review' | 'submitted'>('editing');
  const [thumbnails, setThumbnails] = React.useState<Record<string, string>>({});
  const [generating, setGenerating] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const setupRan = React.useRef(false);

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
  }, [editor]);

  React.useEffect(() => {
    return () => {
      Object.values(thumbnails).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!pageIds) return null;

  const goToPage = (i: number) => {
    editor.setCurrentPage(pageIds[i]);
    setIndex(i);
    // Each page has its own independent camera — without this, only the
    // first page (framed during setup) would reliably show its heading.
    editor.zoomToBounds(HEADING_BOUNDS, { inset: 200, targetZoom: 1 });
  };

  const enterReview = async () => {
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
          Back to review
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
        className="pointer-events-auto flex items-center gap-3 rounded-(--radius-card) bg-surface px-4 py-2 shadow-lg"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-grey-500">
          Prompt {index + 1} of {PROMPT_COUNT}
        </span>
        <span className="text-sm font-medium text-ink">Prompt {index + 1}</span>
        <Button
          size="small"
          variant="contained"
          color="primary"
          disabled={generating}
          onClick={() => (isLast ? enterReview() : goToPage(index + 1))}
        >
          {isLast ? (generating ? 'Preparing…' : 'Finish') : 'Submit'}
        </Button>
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
 * BuilderFlow (the 5-prompt stepper + review) only mounts when NOT readOnly —
 * Spectators just watch whatever page the Builder currently has open, and
 * can scribble with tldraw's built-in Laser tool — a trail drawn via
 * `editor.scribbles`, not real shapes, so it auto-fades and never touches
 * the document store (works even under isReadonly, which blocks every
 * shape-mutating method but not scribbles). Locked on as their only tool
 * since `hideUi` hides the toolbar they'd otherwise use to switch tools.
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

function SyncedGrowthMachineCanvas({
  readOnly,
  roomId,
  syncServerUrl,
}: {
  readOnly: boolean;
  roomId: string;
  syncServerUrl: string;
}) {
  // No upload backend wired up yet (deliberately out of scope — see
  // sync-server/README.md), so pasted images/videos are inlined as base64
  // rather than uploaded. Fine for this board's actual usage (drawings and
  // locked heading shapes), not recommended if large media becomes common.
  const store = useSync({ uri: `${syncServerUrl}/api/connect/${roomId}`, assets: inlineBase64AssetStore });
  return <GrowthMachineCanvas readOnly={readOnly} roomId={roomId} store={store} />;
}

function GrowthMachineCanvas({
  readOnly,
  roomId,
  store,
}: {
  readOnly: boolean;
  roomId: string;
  store?: ReturnType<typeof useSync>;
}) {
  const [editor, setEditor] = React.useState<Editor | null>(null);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        store={store}
        hideUi={readOnly}
        components={components}
        onMount={(ed: Editor) => {
          ed.updateInstanceState({ isReadonly: readOnly });
          if (readOnly) ed.setCurrentTool('laser');
          setEditor(ed);
        }}
      />
      {!readOnly && editor && <BuilderFlow editor={editor} roomId={roomId} />}
    </div>
  );
}
