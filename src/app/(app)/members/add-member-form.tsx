"use client";

import { useActionState } from "react";
import { addMember } from "./actions";
import { DuplicateEmail } from "./duplicate-email";

export function AddMemberForm() {
  const [state, action, pending] = useActionState(addMember, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form className="add-row" action={action}>
      <label className="field">
        Name
        <input
          name="name"
          defaultValue={state.values?.name}
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name && <span className="error">{errors.name}</span>}
      </label>
      <label className="field">
        Email
        <input
          name="email"
          type="email"
          defaultValue={state.values?.email}
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email && <span className="error">{errors.email}</span>}
      </label>
      <button className="button" disabled={pending}>
        Add Member
      </button>
      <div className="add-row-message">
        {state.duplicateEmail && <DuplicateEmail {...state.duplicateEmail} />}
        {state.sameName && (
          <p className="warning" role="alert">
            A Member with this name exists.{" "}
            <button
              className="link-button"
              name="confirmSameName"
              value="1"
              disabled={pending}
            >
              Add anyway
            </button>
          </p>
        )}
      </div>
    </form>
  );
}
