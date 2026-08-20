"use server";

import { revalidatePath } from "next/cache";
import { crudCreate, crudDelete, crudList, crudUpdate } from "./crud-helpers";

const PATH = "/admin/events";

export type AdminEvent = {
  event_id: string;
  topic: string;
  description: string | null;
  duration: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  speaker_id: string | null;
};
export type AdminSpeaker = { speaker_id: string; user_id: string | null; event_id: string | null; bio: string | null };
export type AdminEventTable = { table_id: string; event_id: string | null; table_name: string | null };

export async function listEvents() {
  return crudList<AdminEvent>("event", "start_time");
}
export async function createEvent(values: Partial<AdminEvent>) {
  const result = await crudCreate("event", values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function updateEvent(id: string, values: Partial<AdminEvent>) {
  const result = await crudUpdate("event", "event_id", id, values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function deleteEvent(id: string) {
  const result = await crudDelete("event", "event_id", id);
  if (!result.error) revalidatePath(PATH);
  return result;
}

export async function listSpeakers() {
  return crudList<AdminSpeaker>("speakers");
}
export async function createSpeaker(values: Partial<AdminSpeaker>) {
  const result = await crudCreate("speakers", values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function updateSpeaker(id: string, values: Partial<AdminSpeaker>) {
  const result = await crudUpdate("speakers", "speaker_id", id, values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function deleteSpeaker(id: string) {
  const result = await crudDelete("speakers", "speaker_id", id);
  if (!result.error) revalidatePath(PATH);
  return result;
}

export async function listEventTables() {
  return crudList<AdminEventTable>("event_tables");
}
export async function createEventTable(values: Partial<AdminEventTable>) {
  const result = await crudCreate("event_tables", values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function updateEventTable(id: string, values: Partial<AdminEventTable>) {
  const result = await crudUpdate("event_tables", "table_id", id, values);
  if (!result.error) revalidatePath(PATH);
  return result;
}
export async function deleteEventTable(id: string) {
  const result = await crudDelete("event_tables", "table_id", id);
  if (!result.error) revalidatePath(PATH);
  return result;
}
