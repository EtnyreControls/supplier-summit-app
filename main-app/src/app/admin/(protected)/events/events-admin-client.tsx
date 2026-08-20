"use client";
import * as React from "react";
import { CrudSection, type EntityField } from "@/components";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  createSpeaker,
  updateSpeaker,
  deleteSpeaker,
  createEventTable,
  updateEventTable,
  deleteEventTable,
  type AdminEvent,
  type AdminSpeaker,
  type AdminEventTable,
} from "@/lib/supabase/admin/admin-events";

const EVENT_FIELDS: EntityField[] = [
  { name: "topic", label: "Topic", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "duration", label: "Duration (e.g. 45 min)", required: true },
  { name: "start_time", label: "Start time", type: "datetime" },
  { name: "end_time", label: "End time", type: "datetime" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "upcoming", label: "Upcoming" },
      { value: "live", label: "Live" },
      { value: "completed", label: "Completed" },
    ],
  },
  { name: "speaker_id", label: "Speaker ID" },
];

const SPEAKER_FIELDS: EntityField[] = [
  { name: "user_id", label: "User ID", required: true },
  { name: "event_id", label: "Event ID", required: true },
  { name: "bio", label: "Bio", type: "textarea" },
];

const TABLE_FIELDS: EntityField[] = [
  { name: "event_id", label: "Event ID", required: true },
  { name: "table_name", label: "Table name" },
];

export function EventsAdminClient({
  initialEvents,
  initialSpeakers,
  initialTables,
}: {
  initialEvents: AdminEvent[];
  initialSpeakers: AdminSpeaker[];
  initialTables: AdminEventTable[];
}) {
  const [events, setEvents] = React.useState(initialEvents);
  const [speakers, setSpeakers] = React.useState(initialSpeakers);
  const [tables, setTables] = React.useState(initialTables);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <h1 className="text-xl font-bold text-ink">Events, speakers & tables</h1>

      <CrudSection
        title="Events"
        idKey="event_id"
        rows={events}
        setRows={setEvents}
        columns={[
          { key: "topic", label: "Topic" },
          { key: "status", label: "Status" },
          { key: "start_time", label: "Start" },
        ]}
        fields={EVENT_FIELDS}
        onCreate={createEvent}
        onUpdate={updateEvent}
        onDelete={deleteEvent}
      />

      <CrudSection
        title="Speakers"
        idKey="speaker_id"
        rows={speakers}
        setRows={setSpeakers}
        columns={[
          { key: "user_id", label: "User ID" },
          { key: "event_id", label: "Event ID" },
        ]}
        fields={SPEAKER_FIELDS}
        onCreate={createSpeaker}
        onUpdate={updateSpeaker}
        onDelete={deleteSpeaker}
      />

      <CrudSection
        title="Tables"
        idKey="table_id"
        rows={tables}
        setRows={setTables}
        columns={[
          { key: "table_name", label: "Name" },
          { key: "event_id", label: "Event ID" },
        ]}
        fields={TABLE_FIELDS}
        onCreate={createEventTable}
        onUpdate={updateEventTable}
        onDelete={deleteEventTable}
      />
    </div>
  );
}
