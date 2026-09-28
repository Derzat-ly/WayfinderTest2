"use client";

import { deleteGroup } from "../actions";

/**
 * Deleting asks first, saying how many upcoming Meetings lose the link.
 * Started Meetings keep it by name.
 */
export function DeleteGroupButton({
  group,
}: {
  group: { id: string; name: string; upcomingMeetingCount: number };
}) {
  async function remove() {
    const count = group.upcomingMeetingCount;
    const meetings = `${count} upcoming ${count === 1 ? "Meeting" : "Meetings"}`;
    const confirmed = window.confirm(
      `Delete ${group.name}? It will be taken off ${meetings}, and its Members ` +
        `drop off them unless they're on them another way. Its Members aren't ` +
        `deleted, and started Meetings keep it. This can't be undone.`,
    );
    if (!confirmed) return;
    await deleteGroup(group.id);
  }

  return (
    <form action={remove}>
      <button className="link-button">Delete Group</button>
    </form>
  );
}
