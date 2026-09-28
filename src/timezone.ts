/** True for a named IANA zone such as "Europe/London". UTC offsets like "+01:00" are not zones. */
export function isIanaTimezone(timezone: string): boolean {
  if (!/^[A-Za-z]/.test(timezone)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** How far `timezone`'s wall clock is ahead of UTC at `instant`, in ms. */
function offsetAt(instant: Date, timezone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return wallAsUtc - instant.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The UTC instant at which `timezone`'s wall clock reads `date` ("YYYY-MM-DD")
 * and `time` ("HH:MM"). A time that happens twice as clocks go back is the
 * first of the two; a time skipped as clocks go forward moves on by the gap.
 */
export function zonedToInstant(
  date: string,
  time: string,
  timezone: string,
): Date {
  const wallAsUtc = new Date(`${date}T${time}:00Z`).getTime();
  const offsetBefore = offsetAt(new Date(wallAsUtc - DAY_MS), timezone);
  const offsetAfter = offsetAt(new Date(wallAsUtc + DAY_MS), timezone);
  const readsAsWall = [wallAsUtc - offsetBefore, wallAsUtc - offsetAfter]
    .filter((t) => t + offsetAt(new Date(t), timezone) === wallAsUtc)
    .sort((a, b) => a - b);
  return new Date(readsAsWall[0] ?? wallAsUtc - offsetBefore);
}

/** The inverse of `zonedToInstant`: `timezone`'s wall-clock date and time at `instant`. */
export function instantToZoned(
  instant: Date,
  timezone: string,
): { date: string; time: string } {
  const wall = new Date(instant.getTime() + offsetAt(instant, timezone));
  const [date, rest] = wall.toISOString().split("T");
  return { date, time: rest.slice(0, 5) };
}

/** `instant` as `timezone`'s wall clock reads it, e.g. "Wed 1 Jul 2099, 19:30". */
export function formatInZone(instant: Date, timezone: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hourCycle: "h23",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return `${p.weekday} ${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

/** The browser's IANA zone, or UTC when it can't be detected. */
export function detectTimezone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return detected && isIanaTimezone(detected) ? detected : "UTC";
  } catch {
    return "UTC";
  }
}
