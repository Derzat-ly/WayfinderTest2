"use server";

import { revalidatePath } from "next/cache";
import { requireOrganiserData } from "@/app-context";
import { InvalidTimezoneError } from "@/data/organiser-data";

export type TimezoneState = { error?: string; saved?: boolean };

export async function changeTimezone(
  _previous: TimezoneState,
  form: FormData,
): Promise<TimezoneState> {
  const data = await requireOrganiserData();
  try {
    await data.setTimezone(String(form.get("timezone") ?? ""));
  } catch (error) {
    if (error instanceof InvalidTimezoneError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  return { saved: true };
}
