"use client";

import { useActionState, useState } from "react";
import type { Attendee } from "@/data/organiser-data";
import { describeRepeat } from "@/meeting-series";
import { createMeeting } from "../actions";
import { AttendeeTable, LinkedGroupChips } from "../attendee-table";

type Member = { id: string; name: string; email: string; groupIds: string[] };
type Group = { id: string; name: string };

/** The repeat rule in words as the Meeting page will show it, e.g. "Every 2 weeks on Tuesday." */
function repeatHint(unit: string, every: string, date: string) {
  const count = Number(every);
  if (!Number.isInteger(count) || count < 1) return "";
  // Weekly repeats fall on the first Meeting's weekday; before a date is
  // picked there is none to name.
  if (unit === "week" && !date) {
    return count === 1 ? "Every week." : `Every ${count} weeks.`;
  }
  return `${describeRepeat({
    // Noon UTC on the picked date, so the weekday is that date's.
    anchorStartAt: new Date(`${date || "2000-01-01"}T12:00:00Z`),
    timezone: "UTC",
    intervalUnit: unit === "day" ? "day" : "week",
    intervalCount: count,
  })}.`;
}

export function NewMeetingForm({
  members,
  groups,
  timezone,
}: {
  members: Member[];
  groups: Group[];
  /** The Organiser's timezone, which the Meeting will keep a copy of. */
  timezone: string;
}) {
  const [state, action, pending] = useActionState(createMeeting, {});
  const errors = state.fieldErrors ?? {};
  const values = state.values;
  const [date, setDate] = useState(values?.date ?? "");
  const [repeatUnit, setRepeatUnit] = useState(values?.repeatUnit ?? "");
  const [repeatEvery, setRepeatEvery] = useState(values?.repeatEvery || "1");
  const [picked, setPicked] = useState<Member[]>([]);
  const [choice, setChoice] = useState("");
  const pickedIds = new Set(picked.map((m) => m.id));
  const candidates = members.filter((m) => !pickedIds.has(m.id));

  const [pickedGroups, setPickedGroups] = useState<Group[]>([]);
  const [groupChoice, setGroupChoice] = useState("");
  const pickedGroupIds = new Set(pickedGroups.map((g) => g.id));
  const groupCandidates = groups.filter((g) => !pickedGroupIds.has(g.id));

  function addPicked() {
    const member = candidates.find((m) => m.id === choice);
    if (member) setPicked([...picked, member]);
    setChoice("");
  }

  function addPickedGroup() {
    const group = groupCandidates.find((g) => g.id === groupChoice);
    if (group) {
      setPickedGroups(
        [...pickedGroups, group].sort((a, b) => a.name.localeCompare(b.name)),
      );
    }
    setGroupChoice("");
  }

  // The same rule the data module applies once the Meeting exists.
  const attendees = new Map<string, Attendee>();
  for (const { id, name, email } of picked) {
    attendees.set(id, { memberId: id, name, email, addedVia: "individual" });
  }
  for (const group of pickedGroups) {
    for (const { id, name, email, groupIds } of members) {
      if (attendees.has(id) || !groupIds.includes(group.id)) continue;
      attendees.set(id, {
        memberId: id,
        name,
        email,
        addedVia: "linked",
        group,
      });
    }
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
            value={date}
            onChange={(e) => setDate(e.target.value)}
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
      <div className="field-row">
        <label className="field">
          Repeats
          <select
            name="repeatUnit"
            value={repeatUnit}
            onChange={(e) => setRepeatUnit(e.target.value)}
          >
            <option value="">Does not repeat</option>
            <option value="day">Every so many days</option>
            <option value="week">Every so many weeks</option>
          </select>
        </label>
        {repeatUnit && (
          <label className="field">
            Every how many {repeatUnit === "day" ? "days" : "weeks"}
            <input
              name="repeatEvery"
              type="number"
              min={1}
              step={1}
              value={repeatEvery}
              onChange={(e) => setRepeatEvery(e.target.value)}
              aria-invalid={Boolean(errors.repeatEvery)}
            />
          </label>
        )}
      </div>
      {errors.repeatEvery && (
        <span className="error">{errors.repeatEvery}</span>
      )}
      {repeatUnit && (
        <p className="hint">
          {repeatHint(repeatUnit, repeatEvery, date)} With no end date; each
          Meeting in the Series starts with the details and Attendees chosen
          here.
        </p>
      )}
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
      {pickedGroups.map((g) => (
        <input key={g.id} type="hidden" name="groupId" value={g.id} />
      ))}
      <div className="add-rows">
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
      {groupCandidates.length > 0 && (
        <div className="add-row">
          <label className="field">
            Add a whole Group
            <select
              value={groupChoice}
              onChange={(e) => setGroupChoice(e.target.value)}
            >
              <option value="">Choose a Group…</option>
              {groupCandidates.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button"
            onClick={addPickedGroup}
            disabled={!groupChoice}
          >
            Add
          </button>
        </div>
      )}
      </div>
      <LinkedGroupChips
        groups={pickedGroups.map((g) => ({ ...g, kind: "live" as const }))}
        removeControl={(groupId, name) => (
          <button
            type="button"
            aria-label={`Remove the Group ${name}`}
            onClick={() =>
              setPickedGroups(pickedGroups.filter((g) => g.id !== groupId))
            }
          >
            ×
          </button>
        )}
      />
      <AttendeeTable
        attendees={[...attendees.values()].sort((a, b) =>
          a.name.localeCompare(b.name),
        )}
        removeControl={(attendee) =>
          // Before the Meeting exists, a Group's Members go with its chip.
          attendee.addedVia === "individual" && (
            <button
              type="button"
              className="link-button"
              onClick={() =>
                setPicked(picked.filter((m) => m.id !== attendee.memberId))
              }
            >
              Remove
            </button>
          )
        }
      />
      {state.notFound && (
        <p className="error" role="alert">
          One of those Members or Groups no longer exists. Reload the page and try again.
        </p>
      )}
      <button className="button" disabled={pending}>
        Create meeting
      </button>
    </form>
  );
}
