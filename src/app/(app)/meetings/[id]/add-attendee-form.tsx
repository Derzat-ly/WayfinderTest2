"use client";

import { useActionState } from "react";
import { addAttendee } from "../actions";

export function AddAttendeeForm({
  meetingId,
  candidates,
}: {
  meetingId: string;
  /** Members not yet on the Meeting. */
  candidates: { id: string; name: string; email: string }[];
}) {
  const [state, action, pending] = useActionState(
    addAttendee.bind(null, meetingId),
    {},
  );

  if (candidates.length === 0) return null;

  return (
    <form className="add-row" action={action}>
      <label className="field">
        Add one Member
        <select name="memberId">
          {candidates.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.email})
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
            That Member or Meeting no longer exists.
          </p>
        )}
      </div>
    </form>
  );
}
