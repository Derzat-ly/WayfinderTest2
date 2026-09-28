"use client";

import { deleteMember } from "../actions";

function plural(count: number, one: string) {
  return `${count} ${one}${count === 1 ? "" : "s"}`;
}

/**
 * Deleting asks first, saying what the Member will be taken out of. Past
 * Meetings keep them as a deleted Member.
 */
export function DeleteMemberButton({
  member,
}: {
  member: { id: string; name: string; groupCount: number; upcomingMeetingCount: number };
}) {
  async function remove() {
    const confirmed = window.confirm(
      `Delete ${member.name}? They will be removed from ` +
        `${plural(member.groupCount, "Group")} and ` +
        `${plural(member.upcomingMeetingCount, "upcoming Meeting")}. ` +
        `Past Meetings keep them as a deleted Member. This can't be undone.`,
    );
    if (!confirmed) return;
    await deleteMember(member.id);
  }

  return (
    <form action={remove}>
      <button className="link-button">Delete Member</button>
    </form>
  );
}
