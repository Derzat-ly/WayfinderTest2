import type { ReactNode } from "react";
import type { Attendee } from "@/data/organiser-data";

/** The Attendee table on the New meeting form and the Meeting page. */
export function AttendeeTable<A extends Attendee>({
  attendees,
  removeControl,
}: {
  attendees: A[];
  /** The Remove button for one Attendee; none on a started Meeting. */
  removeControl?: (attendee: A) => ReactNode;
}) {
  if (attendees.length === 0) {
    return <p className="hint">No Attendees yet.</p>;
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Added</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {attendees.map((attendee) => (
          // A deleted Member's record has no Member id, but its email is unique.
          <tr key={attendee.memberId ?? attendee.email}>
            <td>{attendee.name}</td>
            <td>{attendee.email}</td>
            <td>
              <AddedBadge attendee={attendee} />
            </td>
            <td>{removeControl?.(attendee)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AddedBadge({ attendee }: { attendee: Attendee }) {
  switch (attendee.addedVia) {
    case "individual":
      return <span className="badge">added individually</span>;
    case "linked":
      return (
        <span className="badge badge-live">{attendee.group.name} · live</span>
      );
    case "copy":
      return (
        <span className="badge badge-copy">{attendee.group.name} · copy</span>
      );
  }
}

/** The Linked Groups on a Meeting: green while live, amber once a copy. */
export function LinkedGroupChips({
  groups,
  removeControl,
}: {
  groups: { id: string; name: string; kind: "live" | "copy" }[];
  /** The × button for one live chip; none on a started Meeting. */
  removeControl?: (groupId: string, name: string) => ReactNode;
}) {
  if (groups.length === 0) return null;
  return (
    <ul className="chips" aria-label="Linked Groups">
      {groups.map((group) => (
        <li key={group.id} className={`chip chip-${group.kind}`}>
          {group.name}
          {group.kind === "copy" && <span> · copy</span>}
          {group.kind === "live" && removeControl?.(group.id, group.name)}
        </li>
      ))}
    </ul>
  );
}
