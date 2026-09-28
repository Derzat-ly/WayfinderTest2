import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganiserData } from "@/app-context";
import { EditMemberForm } from "./edit-member-form";

export default async function MemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await (await requireOrganiserData()).member(id);
  if (!member) notFound();

  return (
    <>
      <p className="hint">
        <Link href="/members">Members</Link>
      </p>
      <h1>{member.name}</h1>
      <EditMemberForm member={member} />
    </>
  );
}
