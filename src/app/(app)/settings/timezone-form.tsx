"use client";

import { useActionState } from "react";
import { changeTimezone } from "./actions";

export function TimezoneForm({
  current,
  zones,
}: {
  current: string;
  zones: string[];
}) {
  const [state, action, pending] = useActionState(changeTimezone, {});

  return (
    <form className="form" action={action}>
      <p className="hint">Every Meeting you set up uses this timezone.</p>
      <label className="field">
        Timezone
        <select name="timezone" defaultValue={current}>
          {zones.map((zone) => (
            <option key={zone}>{zone}</option>
          ))}
        </select>
      </label>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.saved && <p className="success">Timezone saved.</p>}
      <button className="button" disabled={pending}>
        Save timezone
      </button>
    </form>
  );
}
