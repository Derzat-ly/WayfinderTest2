"use server";

import { revalidatePath } from "next/cache";
import { requireOrganiserData } from "@/app-context";

/** Membership reaches Groups, Members and, through Linked Groups, Meetings. */
function revalidateMembership() {
  revalidatePath("/", "layout");
}

export type CreateGroupState = {
  fieldErrors?: { name?: string };
  created?: boolean;
};

export async function createGroup(
  _previous: CreateGroupState,
  form: FormData,
): Promise<CreateGroupState> {
  const data = await requireOrganiserData();
  const result = await data.createGroup(String(form.get("name") ?? ""));
  if (!result.ok) return result;
  revalidatePath("/groups");
  return { created: true };
}

export type AddToGroupState = { notFound?: boolean };

export async function addToGroup(
  groupId: string,
  _previous: AddToGroupState,
  form: FormData,
): Promise<AddToGroupState> {
  const data = await requireOrganiserData();
  const result = await data.addToGroup(
    groupId,
    String(form.get("memberId") ?? ""),
  );
  if (!result.ok) return result;
  revalidateMembership();
  return {};
}

export async function removeFromGroup(groupId: string, memberId: string) {
  const data = await requireOrganiserData();
  await data.removeFromGroup(groupId, memberId);
  revalidateMembership();
}

/** For the Member page's checkboxes. */
export async function setGroupMembership(
  groupId: string,
  memberId: string,
  isMember: boolean,
) {
  const data = await requireOrganiserData();
  if (isMember) {
    await data.addToGroup(groupId, memberId);
  } else {
    await data.removeFromGroup(groupId, memberId);
  }
  revalidateMembership();
}
