import Link from "next/link";
import { requireOrganiserData } from "@/app-context";
import { CreateGroupForm } from "./create-group-form";

export default async function GroupsPage() {
  const groups = await (await requireOrganiserData()).groups();

  return (
    <>
      <h1>Groups</h1>
      <CreateGroupForm />
      {groups.length === 0 ? (
        <p className="hint">No Groups yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Members</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.id}>
                <td>
                  <Link href={`/groups/${group.id}`}>{group.name}</Link>
                </td>
                <td>{group.memberCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
