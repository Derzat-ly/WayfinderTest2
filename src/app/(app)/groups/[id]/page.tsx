import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganiserData } from "@/app-context";
import { formatInZone } from "@/timezone";
import { AddMemberForm } from "../../members/add-member-form";
import { removeFromGroup } from "../actions";
import { AddExistingMemberForm } from "./add-existing-member-form";
import { DeleteGroupButton } from "./delete-group-button";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await requireOrganiserData();
  const group = await data.group(id);
  if (!group) notFound();
  const inGroup = new Set(group.members.map((m) => m.id));
  const candidates = (await data.members()).filter((m) => !inGroup.has(m.id));

  return (
    <>
      <p className="hint">
        <Link href="/groups">Groups</Link>
      </p>
      <h1>{group.name}</h1>
      {group.upcomingMeetings.length > 0 && (
        <section className="linked-meetings">
          <p className="warning">
            Linked to {group.upcomingMeetings.length} upcoming{" "}
            {group.upcomingMeetings.length === 1 ? "Meeting" : "Meetings"}:
            changes here reach them straight away.
          </p>
          <MeetingList meetings={group.upcomingMeetings} />
        </section>
      )}
      <AddExistingMemberForm groupId={group.id} candidates={candidates} />
      <AddMemberForm groupId={group.id} />
      {group.members.length === 0 ? (
        <p className="hint">No Members in this Group yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {group.members.map((member) => (
              <tr key={member.id}>
                <td>
                  <Link href={`/members/${member.id}`}>{member.name}</Link>
                </td>
                <td>{member.email}</td>
                <td>
                  <form
                    action={removeFromGroup.bind(null, group.id, member.id)}
                  >
                    <button className="link-button">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <DeleteGroupButton
        group={{
          id: group.id,
          name: group.name,
          upcomingMeetingCount: group.upcomingMeetings.length,
        }}
      />
    </>
  );
}

function MeetingList({
  meetings,
}: {
  meetings: { id: string; title: string; startAt: Date; timezone: string }[];
}) {
  return (
    <ul>
      {meetings.map((m) => (
        <li key={m.id}>
          <Link href={`/meetings/${m.id}`}>{m.title}</Link>{" "}
          <span className="hint">{formatInZone(m.startAt, m.timezone)}</span>
        </li>
      ))}
    </ul>
  );
}
