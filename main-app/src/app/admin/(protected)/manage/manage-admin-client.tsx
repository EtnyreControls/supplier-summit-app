"use client";
import * as React from "react";
import { EventsAdminClient } from "../events/events-admin-client";
import { UsersAdminClient } from "../users/users-admin-client";
import { QuestionsAdminClient } from "../questions/questions-admin-client";
import { FeedbackAdminClient } from "../feedback/feedback-admin-client";
import { ContactsAdminClient } from "../contacts/contacts-admin-client";
import { GrowthMachineAdminClient } from "../growth-machine/growth-machine-admin-client";
import type { AdminEvent, AdminSpeaker, AdminEventTable } from "@/lib/supabase/admin/admin-events";
import type { AdminUser } from "@/lib/supabase/admin/admin-users";
import type { AdminQuestionGroup, AdminQuestion } from "@/lib/supabase/admin/admin-questions";
import type { AdminFeedback, AdminFeedbackQuestion } from "@/lib/supabase/admin/admin-feedback";
import type { AdminContact } from "@/lib/supabase/admin/admin-contacts";
import type { AdminGmEntry, AdminGmBoard, AdminGmVote } from "@/lib/supabase/admin/admin-growth-machine";

const SECTIONS = [
  { key: "events", label: "Events, speakers & tables" },
  { key: "users", label: "Users" },
  { key: "questions", label: "Questions" },
  { key: "feedback", label: "Feedback" },
  { key: "contacts", label: "Contacts" },
  { key: "growth-machine", label: "Growth Machine" },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

/**
 * Single page, side-nav-driven CRUD hub — each section below is the same
 * component that used to be its own /admin/<entity> route, just switched
 * client-side instead of via full navigations.
 */
export function ManageAdminClient({
  initialEvents,
  initialSpeakers,
  initialTables,
  initialUsers,
  initialGroups,
  initialQuestions,
  initialFeedback,
  initialFeedbackQuestions,
  initialContacts,
  initialGmEntries,
  initialGmBoards,
  initialGmVotes,
}: {
  initialEvents: AdminEvent[];
  initialSpeakers: AdminSpeaker[];
  initialTables: AdminEventTable[];
  initialUsers: AdminUser[];
  initialGroups: AdminQuestionGroup[];
  initialQuestions: AdminQuestion[];
  initialFeedback: AdminFeedback[];
  initialFeedbackQuestions: AdminFeedbackQuestion[];
  initialContacts: AdminContact[];
  initialGmEntries: AdminGmEntry[];
  initialGmBoards: AdminGmBoard[];
  initialGmVotes: AdminGmVote[];
}) {
  const [section, setSection] = React.useState<SectionKey>("events");

  return (
    <div className="mx-auto flex max-w-6xl gap-8">
      <nav className="w-48 shrink-0">
        <ul className="sticky top-6 flex flex-col gap-1">
          {SECTIONS.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => setSection(s.key)}
                className={`w-full rounded-(--radius-card) px-3 py-2 text-left text-sm ${
                  section === s.key ? "bg-black font-semibold text-white" : "text-grey-600 hover:bg-grey-100"
                }`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">
        {section === "events" && (
          <EventsAdminClient
            initialEvents={initialEvents}
            initialSpeakers={initialSpeakers}
            initialTables={initialTables}
          />
        )}
        {section === "users" && <UsersAdminClient initialUsers={initialUsers} />}
        {section === "questions" && (
          <QuestionsAdminClient initialGroups={initialGroups} initialQuestions={initialQuestions} />
        )}
        {section === "feedback" && (
          <FeedbackAdminClient initialFeedback={initialFeedback} initialQuestions={initialFeedbackQuestions} />
        )}
        {section === "contacts" && <ContactsAdminClient initialContacts={initialContacts} />}
        {section === "growth-machine" && (
          <GrowthMachineAdminClient
            initialEntries={initialGmEntries}
            initialBoards={initialGmBoards}
            initialVotes={initialGmVotes}
          />
        )}
      </div>
    </div>
  );
}
