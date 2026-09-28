import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganiserData } from "@/app-context";
import { formatInZone } from "@/timezone";
import { DeleteMemberButton } from "./delete-member-button";
import { EditMemberForm } from "./edit-member-form";
import { GroupCheckboxes } from "./group-checkboxes";

export default async function MemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await requireOrganiserData();
  const member = await data.member(id);
  if (!member) notFound();
  const groupChoices = await data.groupChoicesFor(id);

  return (
    <>
      <p className="hint">
        <Link href="/members">Members</Link>
      </p>
      <h1>{member.name}</h1>
      <EditMemberForm member={member} />
      <GroupCheckboxes memberId={member.id} choices={groupChoices} />
      <h2>Upcoming Meetings</h2>
      {member.upcomingMeetings.length === 0 ? (
        <p className="hint">Not on any upcoming Meetings.</p>
      ) : (
        <ul>
          {member.upcomingMeetings.map((m) => (
            <li key={m.id}>
              <Link href={`/meetings/${m.id}`}>{m.title}</Link>{" "}
              <span className="hint">
                {formatInZone(m.startAt, m.timezone)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <DeleteMemberButton
        member={{
          id: member.id,
          name: member.name,
          groupCount: member.groups.length,
          upcomingMeetingCount: member.upcomingMeetings.length,
        }}
      />
    </>
  );
}
