import { instantToZoned, zonedToInstant } from "@/timezone";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far ahead each Series keeps its Meetings created (ADR 0001). */
export const SERIES_HORIZON_MS = 90 * DAY_MS;
const DAYS_PER_UNIT = { day: 1, week: 7 };

/** How a Meeting Series repeats, as stored on its row. */
export type RepeatRule = {
  intervalUnit: "day" | "week";
  intervalCount: number;
};

/**
 * When occurrence `n` (0 is the first) of a Series starts: the anchor's
 * local date-time in the Series' timezone plus n intervals, converted back
 * to UTC. Always worked out from the anchor, never from the previous
 * occurrence, so it keeps the same local time across daylight saving.
 */
export function occurrenceStart(
  series: RepeatRule & { anchorStartAt: Date; timezone: string },
  n: number,
): Date {
  const { date, time } = instantToZoned(series.anchorStartAt, series.timezone);
  const days = n * series.intervalCount * DAYS_PER_UNIT[series.intervalUnit];
  const shifted = new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS);
  return zonedToInstant(shifted.toISOString().slice(0, 10), time, series.timezone);
}

/** A Series' repeat rule in words, e.g. "Every 2 weeks on Tuesday". */
export function describeRepeat(
  series: RepeatRule & { anchorStartAt: Date; timezone: string },
): string {
  const { intervalUnit: unit, intervalCount: count } = series;
  const every = count === 1 ? `Every ${unit}` : `Every ${count} ${unit}s`;
  if (unit === "day") return every;
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: series.timezone,
    weekday: "long",
  }).format(series.anchorStartAt);
  return `${every} on ${weekday}`;
}
