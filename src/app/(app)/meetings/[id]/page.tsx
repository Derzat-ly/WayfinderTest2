import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganiserData } from "@/app-context";
import { formatInZone } from "@/timezone";
import { unlinkGroup } from "../actions";
import { AttendeeTable, LinkedGroupChips } from "../attendee-table";
import { AddAttendeeForm } from "./add-attendee-form";
import { AddGroupForm } from "./add-group-form";
import { CopyEmailsButton } from "./copy-emails-button";
import { RemoveAttendeeButton } from "./remove-attendee-button";

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
  const linked = new Set(
    meeting.linkedGroups.filter((g) => g.kind === "live").map((g) => g.id),
  );
  const groupCandidates = (await data.groups()).filter(
    (g) => !linked.has(g.id),
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
      {meeting.started ? (
        <>
          <p className="hint">
            This Meeting has started, so its Attendees are a fixed record of
            who was on it and their details at the start. Later changes to
            Members or Groups don&apos;t change it.
          </p>
          <LinkedGroupChips groups={meeting.linkedGroups} />
          <AttendeeTable attendees={meeting.attendees} />
        </>
      ) : (
        <>
          <div className="add-rows">
            <AddAttendeeForm meetingId={meeting.id} candidates={candidates} />
            <AddGroupForm meetingId={meeting.id} candidates={groupCandidates} />
          </div>
          <LinkedGroupChips
            groups={meeting.linkedGroups}
            removeControl={(groupId, name) => (
              <form action={unlinkGroup.bind(null, meeting.id, groupId)}>
                <button aria-label={`Remove the Group ${name}`}>×</button>
              </form>
            )}
          />
          <AttendeeTable
            attendees={meeting.attendees}
            removeControl={(attendee) => (
              <RemoveAttendeeButton meetingId={meeting.id} attendee={attendee} />
            )}
          />
        </>
      )}
      {meeting.attendees.length > 0 && (
        <CopyEmailsButton emails={meeting.attendees.map((a) => a.email)} />
      )}
    </>
  );
}
