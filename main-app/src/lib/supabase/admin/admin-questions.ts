"use server";

import { revalidatePath } from "next/cache";
import { crudCreate, crudDelete, crudList, crudUpdate } from "./crud-helpers";

const PATH = "/admin/questions";

export type AdminQuestionGroup = {
  group_id: string;
  topic: string | null;
  composed_question: string | null;
  status: string | null;
  speaker_id: string | null;
  checked: boolean | null;
  answer_text: string | null;
};
export type AdminQuestion = {
  question_id: string;
  topic: string | null;
  submission_info: string | null;
  submitter_id: string | null;
  group_id: string;
  status: string | null;
  checked: boolean | null;
};

export async function listQuestionGroups() {
  return crudList<AdminQuestionGroup>("question_groups", "created_at");
}
export async function updateQuestionGroup(id: string, values: Partial<AdminQuestionGroup>) {
  const result = await crudUpdate("question_groups", "group_id", id, values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function deleteQuestionGroup(id: string) {
  const result = await crudDelete("question_groups", "group_id", id);
  if (!result.error) revalidatePath(PATH);
  return result;
}

export async function listQuestions() {
  return crudList<AdminQuestion>("questions");
}
export async function createQuestion(values: Partial<AdminQuestion>) {
  const result = await crudCreate("questions", values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function updateQuestion(id: string, values: Partial<AdminQuestion>) {
  const result = await crudUpdate("questions", "question_id", id, values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function deleteQuestion(id: string) {
  const result = await crudDelete("questions", "question_id", id);
  if (!result.error) revalidatePath(PATH);
  return result;
}
