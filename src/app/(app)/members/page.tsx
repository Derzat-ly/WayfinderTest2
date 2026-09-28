import Link from "next/link";
import { requireOrganiserData } from "@/app-context";
import { AddMemberForm } from "./add-member-form";

export default async function MembersPage() {
  const members = await (await requireOrganiserData()).members();

  return (
    <>
      <h1>Members</h1>
      <AddMemberForm />
      {members.length === 0 ? (
        <p className="hint">No Members yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Groups</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  <Link href={`/members/${member.id}`}>{member.name}</Link>
                </td>
                <td>{member.email}</td>
                <td>
                  {member.groups.map((group, i) => (
                    <span key={group.id}>
                      {i > 0 && ", "}
                      <Link href={`/groups/${group.id}`}>{group.name}</Link>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
