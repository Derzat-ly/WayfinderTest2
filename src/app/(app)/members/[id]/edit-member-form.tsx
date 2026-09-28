"use client";

import { useActionState } from "react";
import { editMember } from "../actions";
import { DuplicateEmail } from "../duplicate-email";

export function EditMemberForm({
  member,
}: {
  member: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    notes: string | null;
  };
}) {
  const [state, action, pending] = useActionState(
    editMember.bind(null, member.id),
    {},
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form className="form" action={action}>
      <label className="field">
        Name
        <input
          name="name"
          defaultValue={member.name}
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name && <span className="error">{errors.name}</span>}
      </label>
      <label className="field">
        Email
        <input
          name="email"
          type="email"
          defaultValue={member.email}
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email && <span className="error">{errors.email}</span>}
      </label>
      <label className="field">
        Phone <span className="hint">optional</span>
        <input name="phone" type="tel" defaultValue={member.phone ?? ""} />
      </label>
      <label className="field">
        Private notes <span className="hint">optional, only you see these</span>
        <textarea name="notes" rows={4} defaultValue={member.notes ?? ""} />
      </label>
      {state.duplicateEmail && <DuplicateEmail {...state.duplicateEmail} />}
      {state.notFound && (
        <p className="error" role="alert">
          This Member no longer exists.
        </p>
      )}
      {state.saved && <p className="success">Member saved.</p>}
      <button className="button" disabled={pending}>
        Save Member
      </button>
    </form>
  );
}
