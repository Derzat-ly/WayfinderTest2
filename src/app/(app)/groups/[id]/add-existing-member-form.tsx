"use client";

import { useActionState } from "react";
import { addToGroup } from "../actions";

export function AddExistingMemberForm({
  groupId,
  candidates,
}: {
  groupId: string;
  /** Members not yet in the Group. */
  candidates: { id: string; name: string; email: string }[];
}) {
  const [state, action, pending] = useActionState(
    addToGroup.bind(null, groupId),
    {},
  );

  if (candidates.length === 0) return null;

  return (
    <form className="add-row" action={action}>
      <label className="field">
        Existing Member
        <select name="memberId">
          {candidates.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.email})
            </option>
          ))}
        </select>
      </label>
      <button className="button" disabled={pending}>
        Add to Group
      </button>
      <div className="add-row-message">
        {state.notFound && (
          <p className="error" role="alert">
            That Member or Group no longer exists.
          </p>
        )}
      </div>
    </form>
  );
}
