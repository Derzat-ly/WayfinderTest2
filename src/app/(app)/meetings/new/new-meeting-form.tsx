"use client";

import { useActionState, useState } from "react";
import { createMeeting } from "../actions";
import { AttendeeTable } from "../attendee-table";

type Member = { id: string; name: string; email: string };

export function NewMeetingForm({
  members,
  timezone,
}: {
  members: Member[];
  /** The Organiser's timezone, which the Meeting will keep a copy of. */
  timezone: string;
}) {
  const [state, action, pending] = useActionState(createMeeting, {});
  const errors = state.fieldErrors ?? {};
  const values = state.values;
  const [picked, setPicked] = useState<Member[]>([]);
  const [choice, setChoice] = useState("");
  const pickedIds = new Set(picked.map((m) => m.id));
  const candidates = members.filter((m) => !pickedIds.has(m.id));

  function addPicked() {
    const member = candidates.find((m) => m.id === choice);
    if (member) setPicked([...picked, member]);
    setChoice("");
  }

  return (
    <form className="form meeting-form" action={action}>
      <label className="field">
        Title
        <input
          name="title"
          defaultValue={values?.title}
          aria-invalid={Boolean(errors.title)}
        />
        {errors.title && <span className="error">{errors.title}</span>}
      </label>
      <div className="field-row">
        <label className="field">
          Date
          <input
            name="date"
            type="date"
            defaultValue={values?.date}
            aria-invalid={Boolean(errors.start)}
          />
        </label>
        <label className="field">
          Start time
          <input
            name="time"
            type="time"
            defaultValue={values?.time}
            aria-invalid={Boolean(errors.start)}
          />
        </label>
        <label className="field">
          Duration (minutes)
          <input
            name="durationMinutes"
            type="number"
            min={1}
            step={1}
            defaultValue={values?.durationMinutes}
            aria-invalid={Boolean(errors.durationMinutes)}
          />
        </label>
      </div>
      {errors.start && <span className="error">{errors.start}</span>}
      {errors.durationMinutes && (
        <span className="error">{errors.durationMinutes}</span>
      )}
      <p className="hint">Times are in {timezone}.</p>
      <label className="field">
        Location
        <input name="location" defaultValue={values?.location} />
      </label>
      <label className="field">
        Notes
        <textarea name="notes" rows={3} defaultValue={values?.notes} />
      </label>
      <label className="field">
        Private notes
        <textarea
          name="privateNotes"
          rows={3}
          defaultValue={values?.privateNotes}
        />
        <span className="hint">Only you see these.</span>
      </label>

      <h2>Attendees</h2>
      {picked.map((m) => (
        <input key={m.id} type="hidden" name="memberId" value={m.id} />
      ))}
      {candidates.length > 0 && (
        <div className="add-row">
          <label className="field">
            Add one Member
            <select value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Choose a Member…</option>
              {candidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button"
            onClick={addPicked}
            disabled={!choice}
          >
            Add
          </button>
        </div>
      )}
      <AttendeeTable
        attendees={picked.map(({ id, ...m }) => ({ memberId: id, ...m }))}
        removeControl={(memberId) => (
          <button
            type="button"
            className="link-button"
            onClick={() => setPicked(picked.filter((m) => m.id !== memberId))}
          >
            Remove
          </button>
        )}
      />
      {state.notFound && (
        <p className="error" role="alert">
          One of those Members no longer exists. Reload the page and try again.
        </p>
      )}
      <button className="button" disabled={pending}>
        Create meeting
      </button>
    </form>
  );
}
