import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganiserData } from "@/app-context";
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
    </>
  );
}
