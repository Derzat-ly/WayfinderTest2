import type { ReactNode } from "react";

/** The live Attendee table on the New meeting form and the Meeting page. */
export function AttendeeTable({
  attendees,
  removeControl,
}: {
  attendees: { memberId: string; name: string; email: string }[];
  /** The Remove button for one Attendee. */
  removeControl: (memberId: string) => ReactNode;
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
          <tr key={attendee.memberId}>
            <td>{attendee.name}</td>
            <td>{attendee.email}</td>
            <td>
              <span className="badge">added individually</span>
            </td>
            <td>{removeControl(attendee.memberId)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
