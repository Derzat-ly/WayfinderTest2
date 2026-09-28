"use client";

import { useTransition } from "react";
import { setGroupMembership } from "../../groups/actions";

export function GroupCheckboxes({
  memberId,
  choices,
}: {
  memberId: string;
  choices: { id: string; name: string; isMember: boolean }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <fieldset className="form">
      <legend>Groups</legend>
      {choices.length === 0 ? (
        <p className="hint">No Groups yet.</p>
      ) : (
        choices.map((group) => (
          <label key={group.id}>
            <input
              type="checkbox"
              checked={group.isMember}
              disabled={pending}
              onChange={(e) => {
                const isMember = e.currentTarget.checked;
                startTransition(() =>
                  setGroupMembership(group.id, memberId, isMember),
                );
              }}
            />{" "}
            {group.name}
          </label>
        ))
      )}
    </fieldset>
  );
}
