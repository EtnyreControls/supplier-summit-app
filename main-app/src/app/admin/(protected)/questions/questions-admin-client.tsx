"use client";
import * as React from "react";
import { CrudSection, type EntityField } from "@/components";
import {
  updateQuestionGroup,
  deleteQuestionGroup,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  type AdminQuestionGroup,
  type AdminQuestion,
} from "@/lib/supabase/admin/admin-questions";

const GROUP_FIELDS: EntityField[] = [
  { name: "topic", label: "Topic" },
  { name: "composed_question", label: "Composed question", type: "textarea" },
  { name: "status", label: "Status" },
  { name: "speaker_id", label: "Speaker ID" },
  { name: "answer_text", label: "Answer", type: "textarea" },
  { name: "checked", label: "Checked", type: "checkbox" },
];

const QUESTION_FIELDS: EntityField[] = [
  { name: "topic", label: "Topic" },
  { name: "submission_info", label: "Submission", type: "textarea" },
  { name: "submitter_id", label: "Submitter ID" },
  { name: "group_id", label: "Group ID", required: true },
  { name: "status", label: "Status" },
  { name: "checked", label: "Checked", type: "checkbox" },
];

export function QuestionsAdminClient({
  initialGroups,
  initialQuestions,
}: {
  initialGroups: AdminQuestionGroup[];
  initialQuestions: AdminQuestion[];
}) {
  const [groups, setGroups] = React.useState(initialGroups);
  const [questions, setQuestions] = React.useState(initialQuestions);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <h1 className="text-xl font-bold text-ink">Questions & moderation</h1>

      <CrudSection
        title="Question groups"
        idKey="group_id"
        allowCreate={false}
        rows={groups}
        setRows={setGroups}
        columns={[
          { key: "topic", label: "Topic" },
          { key: "status", label: "Status" },
          { key: "checked", label: "Checked", render: (r) => (r.checked ? "Yes" : "No") },
        ]}
        fields={GROUP_FIELDS}
        onUpdate={updateQuestionGroup}
        onDelete={deleteQuestionGroup}
      />

      <CrudSection
        title="Questions"
        idKey="question_id"
        rows={questions}
        setRows={setQuestions}
        columns={[
          { key: "topic", label: "Topic" },
          { key: "status", label: "Status" },
          { key: "group_id", label: "Group ID" },
        ]}
        fields={QUESTION_FIELDS}
        onCreate={createQuestion}
        onUpdate={updateQuestion}
        onDelete={deleteQuestion}
      />
    </div>
  );
}
