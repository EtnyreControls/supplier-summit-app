"use client";
import * as React from "react";
import Card from "@mui/material/Card";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

export interface SavedContact {
  id: string; // contact_user_id
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
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

/** One saved contact — mirrors the badge-scan snapshot, so only opted-in fields ever show up. */
function ContactRow({ contact, onRemove }: { contact: SavedContact; onRemove: (id: string) => void }) {
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <Avatar sx={{ width: 40, height: 40, fontSize: 14 }}>{initialsOf(contact.name)}</Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink">{contact.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-grey-600">
          {contact.phone && (
            <span className="flex items-center gap-1">
              <PhoneRoundedIcon sx={{ fontSize: 14 }} />
              {contact.phone}
            </span>
          )}
          {contact.email && (
            <span className="flex items-center gap-1 truncate">
              <EmailRoundedIcon sx={{ fontSize: 14 }} />
              {contact.email}
            </span>
          )}
          {contact.company && (
            <span className="flex items-center gap-1 truncate">
              <BusinessRoundedIcon sx={{ fontSize: 14 }} />
              {contact.company}
            </span>
          )}
        </div>
      </div>
      <IconButton
        aria-label={`Remove ${contact.name}`}
        size="small"
        onClick={() => onRemove(contact.id)}
        className="shrink-0 text-grey-400 hover:text-red-600"
      >
        <DeleteOutlineRoundedIcon fontSize="small" />
      </IconButton>
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
  return (
    <div className="flex flex-col gap-2">
      {contacts.map((c) => (
        <ContactRow key={c.id} contact={c} onRemove={onRemove} />
      ))}
    </div>
  );
}
