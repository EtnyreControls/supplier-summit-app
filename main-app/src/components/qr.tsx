"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Switch from "@mui/material/Switch";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import QRCode from "react-qr-code";
import { getMyBadgeQrToken, handleQrScan } from "@/app/qr/actions";
import { BadgeScanner } from "./qr-scanner";

/**
 * Frame for the "Share my contact" QR. Renders whichever QR library the
 * project lands on (react-qr-code / qrcode.react) via `children`, keeping
 * this library dependency-free:
 *
 *   <QrBadge name="Sarah Chen" company="Hendrick Screen">
 *     <QRCode value={shareUrl} size={220} />
 *   </QrBadge>
 */
export function QrBadge({
  name,
  company,
  children,
}: {
  name: string;
  company?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-xs rounded-(--radius-card) border border-grey-200 bg-surface p-5 text-center">
      {/* Intentionally literal white in both modes: QR codes need a white
          quiet zone to scan reliably, especially on a dark screen. */}
      <div className="mx-auto flex aspect-square w-full items-center justify-center rounded-(--radius-control) bg-white p-2 outline-4 outline-yellow">
        {children}
      </div>
      <p className="mt-4 text-[15px] font-bold text-ink">{name}</p>
      {company && <p className="text-[13px] text-grey-600">{company}</p>}
      <p className="mt-2 text-xs text-grey-500">Have them scan this code to save your contact</p>
    </div>
  );
}

export interface ShareField {
  id: string;
  label: string;
  value: string;
  shared: boolean;
}

/** Per-field visibility toggles for contact sharing. */
export function ContactShareList({
  fields,
  onToggle,
}: {
  fields: ShareField[];
  onToggle: (id: string, shared: boolean) => void;
}) {
  return (
    <div className="overflow-hidden rounded-(--radius-card) border border-grey-200 bg-surface">
      {fields.map((f, i) => (
        <label
          key={f.id}
          className={`flex cursor-pointer items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-grey-100" : ""}`}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-ink">{f.label}</span>
            <span className="block truncate text-[13px] text-grey-600">{f.value}</span>
          </span>
          <Switch
            checked={f.shared}
            onChange={(e) => onToggle(f.id, e.target.checked)}
            slotProps={{ input: { "aria-label": `Share ${f.label}` } }}
          />
        </label>
      ))}
    </div>
  );
}

type ScanOutcome = { message: string; isError: boolean };

/**
 * "My badge QR" dialog, opened from TopNav's yellow QR button. Two tabs:
 *   - "My QR" — your own badge, to be scanned by someone else's device.
 *   - "Scan a badge" — this device's camera scanning someone ELSE's badge.
 *
 * Both tabs ultimately go through handleQrScan (app/qr/actions.ts), which
 * decides login-vs-contact-save from session state, not from which tab —
 * scanning here always happens while you already have a session, so in
 * practice this tab only ever produces a contact save (or a "that's you"
 * no-op), never a login.
 */
function BadgeQrDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"mine" | "scan">("mine");
  const [state, setState] = React.useState<
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; url: string; name: string; company: string | null }
  >({ status: "loading" });
  const [scanResult, setScanResult] = React.useState<ScanOutcome | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTab("mine");
    setScanResult(null);
    setState({ status: "loading" });
    (async () => {
      const { token, name, company, error } = await getMyBadgeQrToken();
      if (error || !token) {
        setState({ status: "error", error: error ?? "Could not load your badge" });
        return;
      }
      const url = `${window.location.origin}/qr?t=${encodeURIComponent(token)}`;
      setState({ status: "ready", url, name: name ?? "Attendee", company });
    })();
  }, [open]);

  const handleScanned = async (token: string) => {
    const result = await handleQrScan(token);
    switch (result.mode) {
      case "contact":
        setScanResult({
          message: `Saved ${result.contact.name}${result.contact.company ? ` (${result.contact.company})` : ""} to your contacts.`,
          isError: false,
        });
        return;
      case "self":
        setScanResult({ message: "That's your own badge.", isError: false });
        return;
      case "login":
        if (result.error) {
          setScanResult({ message: result.error, isError: true });
          return;
        }
        onClose();
        router.push("/welcome");
        router.refresh();
        return;
      case "error":
        setScanResult({ message: result.error, isError: true });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle className="flex items-center justify-between gap-2">
        Badge QR
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => { setTab(v); setScanResult(null); }} variant="fullWidth">
        <Tab value="mine" label="My QR" />
        <Tab value="scan" label="Scan a badge" />
      </Tabs>
      <DialogContent>
        {tab === "mine" && (
          <>
            {state.status === "loading" && <p className="py-6 text-center text-sm text-grey-600">Loading…</p>}
            {state.status === "error" && (
              <p className="py-6 text-center text-sm text-grey-600">{state.error}</p>
            )}
            {state.status === "ready" && (
              <QrBadge name={state.name} company={state.company ?? undefined}>
                <QRCode value={state.url} size={220} />
              </QrBadge>
            )}
          </>
        )}
        {tab === "scan" &&
          (scanResult ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className={`text-sm ${scanResult.isError ? "text-red-600" : "text-ink"}`}>{scanResult.message}</p>
              <Button size="small" onClick={() => setScanResult(null)}>
                Scan another
              </Button>
            </div>
          ) : (
            <BadgeScanner onScan={handleScanned} />
          ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Owns the open/close state so pages only need `openBadgeQr` + `{badgeQrModal}`. */
export function useBadgeQrModal() {
  const [open, setOpen] = React.useState(false);
  return {
    badgeQrModal: <BadgeQrDialog open={open} onClose={() => setOpen(false)} />,
    openBadgeQr: () => setOpen(true),
  };
}
