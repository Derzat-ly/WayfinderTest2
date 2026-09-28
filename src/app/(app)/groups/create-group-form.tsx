"use client";

import { useActionState } from "react";
import { createGroup } from "./actions";

export function CreateGroupForm() {
  const [state, action, pending] = useActionState(createGroup, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form className="add-row" action={action}>
      <label className="field">
        Name
        <input name="name" aria-invalid={Boolean(errors.name)} />
        {errors.name && <span className="error">{errors.name}</span>}
      </label>
      <button className="button" disabled={pending}>
        Create Group
      </button>
    </form>
  );
}
