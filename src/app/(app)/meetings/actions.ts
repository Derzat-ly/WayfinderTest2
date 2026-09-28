"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganiserData } from "@/app-context";
import type { MeetingFieldErrors } from "@/data/organiser-data";

const detailNames = [
  "title",
  "date",
  "time",
  "durationMinutes",
  "location",
  "notes",
  "privateNotes",
] as const;

export type MeetingDetails = Record<(typeof detailNames)[number], string>;

export type CreateMeetingState = {
  fieldErrors?: MeetingFieldErrors;
  /** A picked Member is gone. */
  notFound?: boolean;
  /** What was typed, so a refused create keeps it. */
  values?: MeetingDetails;
};

export async function createMeeting(
  _previous: CreateMeetingState,
  form: FormData,
): Promise<CreateMeetingState> {
  const data = await requireOrganiserData();
  const values = Object.fromEntries(
    detailNames.map((name) => [name, String(form.get(name) ?? "")]),
  ) as MeetingDetails;
  const result = await data.createMeeting(values, {
    memberIds: form.getAll("memberId").map(String),
  });
  if (!result.ok) return { ...result, values };
  revalidatePath("/meetings", "layout");
  redirect(`/meetings/${result.meeting.id}`);
}

export type AddAttendeeState = { notFound?: boolean };

export async function addAttendee(
  meetingId: string,
  _previous: AddAttendeeState,
  form: FormData,
): Promise<AddAttendeeState> {
  const data = await requireOrganiserData();
  const result = await data.addAttendee(
    meetingId,
    String(form.get("memberId") ?? ""),
  );
  if (!result.ok) return result;
  revalidatePath("/meetings", "layout");
  return {};
}

export async function removeAttendee(meetingId: string, memberId: string) {
  const data = await requireOrganiserData();
  await data.removeAttendee(meetingId, memberId);
  revalidatePath("/meetings", "layout");
}
