"use client";
import * as React from "react";
import Card from "@mui/material/Card";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";

export interface SavedContact {
  id: string; // contact_user_id
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  savedAt: string; // ISO timestamp
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Date and time are formatted separately and joined with a literal ", "
// rather than passing both fields to one Intl.DateTimeFormat call — the
// combined dateTime pattern's connector word ("at" vs ",") differs between
// ICU versions, which differ between Node (SSR) and the browser (CSR) and
// caused a hydration mismatch when they disagreed.
function formatSavedAt(iso: string) {
  const date = new Date(iso);
  const datePart = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  return `${datePart}, ${timePart}`;
}

/** One saved contact — mirrors the badge-scan snapshot, so only opted-in fields ever show up. */
function ContactRow({
  contact,
  expanded,
  onToggle,
  onRemove,
}: {
  contact: SavedContact;
  expanded: boolean;
  onToggle: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-3.5 text-left"
      >
        <Avatar sx={{ width: 40, height: 40, fontSize: 14 }}>{initialsOf(contact.name)}</Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink">{contact.name}</p>
          {contact.company && !expanded && (
            <p className="truncate text-[13px] text-grey-600">{contact.company}</p>
          )}
        </div>
        <IconButton
          aria-label={`Remove ${contact.name}`}
          size="small"
          component="span"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(contact.id);
          }}
          className="shrink-0 text-grey-400 hover:text-red-600"
        >
          <DeleteOutlineRoundedIcon fontSize="small" />
        </IconButton>
        <ExpandMoreRoundedIcon
          className={`shrink-0 text-grey-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fontSize="small"
        />
      </button>
      <Collapse in={expanded}>
        <div className="flex flex-col gap-1.5 border-t border-grey-100 px-3.5 pb-3.5 pt-3 text-[13px] text-grey-600">
          {contact.phone && (
            <span className="flex items-center gap-2">
              <PhoneRoundedIcon sx={{ fontSize: 15 }} />
              {contact.phone}
            </span>
          )}
          {contact.email && (
            <span className="flex items-center gap-2 truncate">
              <EmailRoundedIcon sx={{ fontSize: 15 }} />
              {contact.email}
            </span>
          )}
          {contact.company && (
            <span className="flex items-center gap-2 truncate">
              <BusinessRoundedIcon sx={{ fontSize: 15 }} />
              {contact.company}
            </span>
          )}
          <span className="mt-1 text-xs text-grey-500">Saved {formatSavedAt(contact.savedAt)}</span>
        </div>
      </Collapse>
    </Card>
  );
}

export function ContactsList({
  contacts,
  onRemove,
}: {
  contacts: SavedContact[];
  onRemove: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(contacts[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-2">
      {contacts.map((c) => (
        <ContactRow
          key={c.id}
          contact={c}
          expanded={expandedId === c.id}
          onToggle={() => setExpandedId((cur) => (cur === c.id ? null : c.id))}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
