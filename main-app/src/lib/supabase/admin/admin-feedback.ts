"use server";

import { revalidatePath } from "next/cache";
import { crudCreate, crudDelete, crudList, crudUpdate } from "./crud-helpers";

const PATH = "/admin/feedback";

export type AdminFeedback = {
  poll_id: string;
  poll_name: string | null;
  description: string | null;
  status: "locked" | "live" | "unlocked" | null;
  is_anonymous: boolean | null;
  event_id: string | null;
};
export type AdminFeedbackQuestion = {
  poll_question_id: string;
  poll_id: string;
  question_text: string;
  question_type: "mcq" | "text" | "rating";
  options: string | null;
};

export async function listFeedback() {
  return crudList<AdminFeedback>("feedback", "created_at");
}
export async function createFeedback(values: Partial<AdminFeedback>) {
  const result = await crudCreate("feedback", values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function updateFeedback(id: string, values: Partial<AdminFeedback>) {
  const result = await crudUpdate("feedback", "poll_id", id, values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function deleteFeedback(id: string) {
  const result = await crudDelete("feedback", "poll_id", id);
  if (!result.error) revalidatePath(PATH);
  return result;
}

export async function listFeedbackQuestions() {
  return crudList<AdminFeedbackQuestion>("feedback_questions");
}
export async function createFeedbackQuestion(values: Partial<AdminFeedbackQuestion>) {
  const result = await crudCreate("feedback_questions", values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function updateFeedbackQuestion(id: string, values: Partial<AdminFeedbackQuestion>) {
  const result = await crudUpdate("feedback_questions", "poll_question_id", id, values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function deleteFeedbackQuestion(id: string) {
  const result = await crudDelete("feedback_questions", "poll_question_id", id);
  if (!result.error) revalidatePath(PATH);
  return result;
}
