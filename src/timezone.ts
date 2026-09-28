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

/** The browser's IANA zone, or UTC when it can't be detected. */
export function detectTimezone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return detected && isIanaTimezone(detected) ? detected : "UTC";
  } catch {
    return "UTC";
  }
}
