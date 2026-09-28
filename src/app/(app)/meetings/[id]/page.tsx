import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganiserData } from "@/app-context";
import { formatInZone } from "@/timezone";
import { removeAttendee } from "../actions";
import { AttendeeTable } from "../attendee-table";
import { AddAttendeeForm } from "./add-attendee-form";
import { CopyEmailsButton } from "./copy-emails-button";

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await requireOrganiserData();
  const meeting = await data.meeting(id);
  if (!meeting) notFound();
  const attending = new Set(meeting.attendees.map((a) => a.memberId));
  const candidates = (await data.members()).filter(
    (m) => !attending.has(m.id),
  );

  return (
    <>
      <p className="hint">
        <Link href="/meetings">Meetings</Link>
      </p>
      <h1>{meeting.title}</h1>
      <dl className="details">
        <dt>When</dt>
        <dd>
          {formatInZone(meeting.startAt, meeting.timezone)}{" "}
          <span className="hint">{meeting.timezone}</span>
        </dd>
        {meeting.durationMinutes !== null && (
          <>
            <dt>Duration</dt>
            <dd>{meeting.durationMinutes} minutes</dd>
          </>
        )}
        {meeting.location && (
          <>
            <dt>Location</dt>
            <dd>{meeting.location}</dd>
          </>
        )}
        {meeting.notes && (
          <>
            <dt>Notes</dt>
            <dd className="multiline">{meeting.notes}</dd>
          </>
        )}
        {meeting.privateNotes && (
          <>
            <dt>Private notes</dt>
            <dd className="multiline">
              {meeting.privateNotes}{" "}
              <span className="hint">(only you see these)</span>
            </dd>
          </>
        )}
      </dl>

      <h2>Attendees</h2>
      <AddAttendeeForm meetingId={meeting.id} candidates={candidates} />
      <AttendeeTable
        attendees={meeting.attendees}
        removeControl={(memberId) => (
          <form action={removeAttendee.bind(null, meeting.id, memberId)}>
            <button className="link-button">Remove</button>
          </form>
        )}
      />
      {meeting.attendees.length > 0 && (
        <CopyEmailsButton emails={meeting.attendees.map((a) => a.email)} />
      )}
    </>
  );
}
