"use client";

import type { Attendee } from "@/data/organiser-data";
import { removeAttendee } from "../actions";

/**
 * Removing a Member who came through a Linked Group asks first, because it
 * turns that link into a one-off copy for this Meeting.
 */
export function RemoveAttendeeButton({
  meetingId,
  attendee,
}: {
  meetingId: string;
  attendee: Attendee;
}) {
  const linked = attendee.addedVia === "linked";

  async function remove() {
    if (linked) {
      const group = attendee.group.name;
      const confirmed = window.confirm(
        `${attendee.name} is on this Meeting through the Group ${group}. ` +
          `Removing them turns ${group} into a one-off copy for this Meeting only: ` +
          `the rest of ${group} stay, but later changes to ${group} won't reach this Meeting.`,
      );
      if (!confirmed) return;
    }
    await removeAttendee(meetingId, attendee.memberId, linked);
  }

  return (
    <form action={remove}>
      {linked && (
        <span
          className="warning"
          title={`Came through ${attendee.group.name}: removing asks first`}
        >
          ⚠{" "}
        </span>
      )}
      <button className="link-button">Remove</button>
    </form>
  );
}
