"use client";

import { useActionState } from "react";
import { linkGroup } from "../actions";

export function AddGroupForm({
  meetingId,
  candidates,
}: {
  meetingId: string;
  /** Groups not yet linked to the Meeting. */
  candidates: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(
    linkGroup.bind(null, meetingId),
    {},
  );

  if (candidates.length === 0) return null;

  return (
    <form className="add-row" action={action}>
      <label className="field">
        Add a whole Group
        <select name="groupId">
          {candidates.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <button className="button" disabled={pending}>
        Add
      </button>
      <div className="add-row-message">
        {state.notFound && (
          <p className="error" role="alert">
            That Group or Meeting no longer exists.
          </p>
        )}
      </div>
    </form>
  );
}
