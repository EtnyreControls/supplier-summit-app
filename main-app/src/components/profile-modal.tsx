"use client";
import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import { ContactShareList, type ShareField } from "./qr";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  name: string;
  initials: string;
  company: string | null;
  isAdmin: boolean;
  tableNumber: string | null;
};

type MembershipRow = { event_tables: { table_name: string | null } | null };

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Maps a ShareField.id to the "user" column that stores its toggle.
const SHARE_COLUMN = {
  email: "share_email",
  phone: "share_phone",
  company: "share_company",
} as const;

/**
 * "My profile" dialog — real signed-in user's contact info, with the same
 * per-field share toggles as the style guide's "Contact sharing" section.
 * Toggles read from and write to user.share_email/share_phone/share_company,
 * so they persist across reloads instead of resetting each open.
 */
export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [fields, setFields] = React.useState<ShareField[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("idle");

  React.useEffect(() => {
    if (!open || profile) return;
    setStatus("loading");
    const supabase = createClient();

    (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        setStatus("error");
        return;
      }

      const [{ data, error }, { data: membership }] = await Promise.all([
        supabase
          .from("user")
          .select("first_name, last_name, company, email, phone, share_email, share_phone, share_company, role")
          .eq("user_id", authUser.id)
          .single(),
        supabase
          .from("event_table_members")
          .select("event_tables(table_name)")
          .eq("user_id", authUser.id)
          .limit(1)
          .maybeSingle<MembershipRow>(),
      ]);

      if (error || !data) {
        setStatus("error");
        return;
      }

      const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || "Attendee";
      setUserId(authUser.id);
      setProfile({
        name,
        initials: initialsOf(name),
        company: data.company,
        isAdmin: data.role === "admin",
        tableNumber: membership?.event_tables?.table_name ?? null,
      });
      setFields([
        { id: "email", label: "Email", value: data.email ?? "Not set", shared: data.share_email },
        { id: "phone", label: "Phone", value: data.phone ?? "Not set", shared: data.share_phone },
        { id: "company", label: "Company", value: data.company ?? "Not set", shared: data.share_company },
      ]);
      setStatus("idle");
    })();
  }, [open, profile]);

  const handleToggle = async (id: string, shared: boolean) => {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, shared } : f)));
    if (!userId) return;
    const column = SHARE_COLUMN[id as keyof typeof SHARE_COLUMN];
    if (!column) return;
    const supabase = createClient();
    const { error } = await supabase.from("user").update({ [column]: shared }).eq("user_id", userId);
    if (error) {
      // Revert on failure so the switch never lies about what's saved.
      setFields((fs) => fs.map((f) => (f.id === id ? { ...f, shared: !shared } : f)));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle className="flex items-center justify-between gap-2">
        My profile
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {status === "loading" && (
          <p className="py-6 text-center text-sm text-grey-600">Loading…</p>
        )}
        {status === "error" && (
          <p className="py-6 text-center text-sm text-grey-600">Couldn&apos;t load your profile.</p>
        )}
        {status === "idle" && profile && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar sx={{ width: 56, height: 56, fontSize: 20 }}>{profile.initials}</Avatar>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold text-ink">{profile.name}</p>
                {profile.company && <p className="truncate text-[13px] text-grey-600">{profile.company}</p>}
                {profile.tableNumber && (
                  <p className="truncate text-[13px] text-grey-600">Table {profile.tableNumber}</p>
                )}
              </div>
            </div>
            <ContactShareList fields={fields} onToggle={handleToggle} />
            {profile.isAdmin && (
              // Deliberately the one link from the attendee app into
              // /admin — gated by role and shown only to the signed-in
              // admin themselves in their own profile, not general nav, so
              // it doesn't compromise the admin area's isolation.
              <Button
                href="/admin"
                variant="outlined"
                color="secondary"
                startIcon={<AdminPanelSettingsRoundedIcon />}
                fullWidth
              >
                Admin portal
              </Button>
            )}
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Owns the open/close state so pages only need `openProfile` + `{profileModal}`. */
export function useProfileModal() {
  const [open, setOpen] = React.useState(false);
  return {
    profileModal: <ProfileModal open={open} onClose={() => setOpen(false)} />,
    openProfile: () => setOpen(true),
  };
}
