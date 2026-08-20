import { listEvents, listSpeakers, listEventTables } from "@/lib/supabase/admin/admin-events";
import { listUsers } from "@/lib/supabase/admin/admin-users";
import { listQuestionGroups, listQuestions } from "@/lib/supabase/admin/admin-questions";
import { listFeedback, listFeedbackQuestions } from "@/lib/supabase/admin/admin-feedback";
import { listContacts } from "@/lib/supabase/admin/admin-contacts";
import { listGmEntries, listGmBoards, listGmVotes } from "@/lib/supabase/admin/admin-growth-machine";
import { ManageAdminClient } from "./manage-admin-client";

/**
 * Single-page CRUD hub — every entity screen used to be its own route
 * (/admin/events, /admin/users, ...); folded into one page with a side nav
 * (see ManageAdminClient) so managing data doesn't mean bouncing between
 * full page loads. All initial data is fetched here up front since none of
 * these lists are large enough to justify per-section lazy fetching.
 */
export default async function AdminManagePage() {
  const [events, speakers, tables, users, groups, questions, feedback, feedbackQuestions, contacts, gmEntries, gmBoards, gmVotes] =
    await Promise.all([
      listEvents(),
      listSpeakers(),
      listEventTables(),
      listUsers(),
      listQuestionGroups(),
      listQuestions(),
      listFeedback(),
      listFeedbackQuestions(),
      listContacts(),
      listGmEntries(),
      listGmBoards(),
      listGmVotes(),
    ]);

  return (
    <ManageAdminClient
      initialEvents={events.data}
      initialSpeakers={speakers.data}
      initialTables={tables.data}
      initialUsers={users.data}
      initialGroups={groups.data}
      initialQuestions={questions.data}
      initialFeedback={feedback.data}
      initialFeedbackQuestions={feedbackQuestions.data}
      initialContacts={contacts.data}
      initialGmEntries={gmEntries.data}
      initialGmBoards={gmBoards.data}
      initialGmVotes={gmVotes.data}
    />
  );
}
