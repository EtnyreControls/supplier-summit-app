"use client";
import * as React from "react";
import { CrudSection, type EntityField } from "@/components";
import {
  createFeedback,
  updateFeedback,
  deleteFeedback,
  createFeedbackQuestion,
  updateFeedbackQuestion,
  deleteFeedbackQuestion,
  type AdminFeedback,
  type AdminFeedbackQuestion,
} from "@/lib/supabase/admin/admin-feedback";

const FEEDBACK_FIELDS: EntityField[] = [
  { name: "poll_name", label: "Name", required: true },
  { name: "description", label: "Description", type: "textarea" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "locked", label: "Locked" },
      { value: "live", label: "Live" },
      { value: "unlocked", label: "Unlocked" },
    ],
  },
  { name: "is_anonymous", label: "Anonymous", type: "checkbox" },
  { name: "event_id", label: "Event ID" },
];

const QUESTION_FIELDS: EntityField[] = [
  { name: "poll_id", label: "Feedback ID", required: true },
  { name: "question_text", label: "Question text", type: "textarea", required: true },
  {
    name: "question_type",
    label: "Type",
    type: "select",
    required: true,
    options: [
      { value: "mcq", label: "Multiple choice" },
      { value: "text", label: "Text" },
      { value: "rating", label: "Rating" },
    ],
  },
  { name: "options", label: "Options (comma-separated, for MCQ)" },
];

export function FeedbackAdminClient({
  initialFeedback,
  initialQuestions,
}: {
  initialFeedback: AdminFeedback[];
  initialQuestions: AdminFeedbackQuestion[];
}) {
  const [feedback, setFeedback] = React.useState(initialFeedback);
  const [questions, setQuestions] = React.useState(initialQuestions);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <h1 className="text-xl font-bold text-ink">Feedback</h1>

      <CrudSection
        title="Feedback surveys"
        idKey="poll_id"
        rows={feedback}
        setRows={setFeedback}
        columns={[
          { key: "poll_name", label: "Name" },
          { key: "status", label: "Status" },
        ]}
        fields={FEEDBACK_FIELDS}
        onCreate={createFeedback}
        onUpdate={updateFeedback}
        onDelete={deleteFeedback}
      />

      <CrudSection
        title="Feedback questions"
        idKey="poll_question_id"
        rows={questions}
        setRows={setQuestions}
        columns={[
          { key: "question_text", label: "Question" },
          { key: "question_type", label: "Type" },
        ]}
        fields={QUESTION_FIELDS}
        onCreate={createFeedbackQuestion}
        onUpdate={updateFeedbackQuestion}
        onDelete={deleteFeedbackQuestion}
      />
    </div>
  );
}
