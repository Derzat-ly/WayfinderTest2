import Link from "next/link";
import { requireOrganiserData } from "@/app-context";
import { formatInZone } from "@/timezone";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const showPast = tab === "past";
  const data = await requireOrganiserData();
  const { timezone } = await data.organiser();
  const { upcoming, past } = await data.meetings();
  const meetings = showPast ? past : upcoming;

  return (
    <>
      <h1>Meetings</h1>
      <p>
        <Link className="button" href="/meetings/new">
          New meeting
        </Link>
      </p>
      <nav className="tabs">
        <Link href="/meetings" aria-current={showPast ? undefined : "page"}>
          Upcoming
        </Link>
        <Link
          href="/meetings?tab=past"
          aria-current={showPast ? "page" : undefined}
        >
          Past
        </Link>
      </nav>
      {meetings.length === 0 ? (
        <p className="hint">
          {showPast ? "No past Meetings." : "No upcoming Meetings."}
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Title</th>
              <th>Attendees</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((meeting) => (
              <tr key={meeting.id}>
                <td>
                  {formatInZone(meeting.startAt, meeting.timezone)}
                  {meeting.timezone !== timezone && (
                    <span className="hint"> {meeting.timezone}</span>
                  )}
                </td>
                <td>
                  <Link href={`/meetings/${meeting.id}`}>{meeting.title}</Link>
                </td>
                <td>{meeting.attendeeCount}</td>
                <td>{meeting.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
