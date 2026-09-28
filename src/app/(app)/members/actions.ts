"use server";

import { revalidatePath } from "next/cache";
import { requireOrganiserData } from "@/app-context";
import type { MemberFieldErrors } from "@/data/organiser-data";

type MemberFormState = {
  fieldErrors?: MemberFieldErrors;
  duplicateEmail?: { id: string; name: string };
};

export type AddMemberState = MemberFormState & {
  sameName?: boolean;
  /** The Group the Member was being added into is gone. */
  notFound?: boolean;
  /** What was typed, so a refused or warned add keeps it. */
  values?: { name: string; email: string };
  added?: boolean;
};

export async function addMember(
  _previous: AddMemberState,
  form: FormData,
): Promise<AddMemberState> {
  const data = await requireOrganiserData();
  const values = {
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
  };
  const groupId = form.get("groupId");
  const result = await data.addMember(values, {
    confirmSameName: form.get("confirmSameName") === "1",
    groupId: groupId ? String(groupId) : undefined,
  });
  if (!result.ok) return { ...result, values };
  revalidatePath("/members");
  if (groupId) revalidatePath("/groups", "layout");
  return { added: true };
}

export type EditMemberState = MemberFormState & {
  notFound?: boolean;
  saved?: boolean;
};

export async function editMember(
  id: string,
  _previous: EditMemberState,
  form: FormData,
): Promise<EditMemberState> {
  const data = await requireOrganiserData();
  const result = await data.updateMember(id, {
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    phone: String(form.get("phone") ?? ""),
    notes: String(form.get("notes") ?? ""),
  });
  if (!result.ok) return result;
  revalidatePath("/members");
  return { saved: true };
}
