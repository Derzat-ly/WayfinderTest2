import { describe, expect, it } from "vitest";
import { formatInZone, zonedToInstant } from "@/timezone";

describe("zonedToInstant(date, time, timezone)", () => {
  it("reads a summer time in London as British Summer Time", () => {
    expect(zonedToInstant("2026-07-01", "19:30", "Europe/London")).toEqual(
      new Date("2026-07-01T18:30:00Z"),
    );
  });

  it("reads a time that happens twice as clocks go back as the first of the two", () => {
    expect(zonedToInstant("2026-10-25", "01:30", "Europe/London")).toEqual(
      new Date("2026-10-25T00:30:00Z"),
    );
  });

  it("moves a time skipped as clocks go forward on by the gap", () => {
    // 01:30 never happens in London that night; 02:30 BST does.
    expect(zonedToInstant("2026-03-29", "01:30", "Europe/London")).toEqual(
      new Date("2026-03-29T01:30:00Z"),
    );
  });

  it("reads a winter time in New York as Eastern Standard Time", () => {
    expect(zonedToInstant("2026-01-15", "09:00", "America/New_York")).toEqual(
      new Date("2026-01-15T14:00:00Z"),
    );
  });
});

describe("formatInZone(instant, timezone)", () => {
  it("shows an instant as the wall time in that zone", () => {
    const start = new Date("2099-07-01T18:30:00Z");

    expect(formatInZone(start, "Europe/London")).toBe("Wed 1 Jul 2099, 19:30");
    expect(formatInZone(start, "America/New_York")).toBe(
      "Wed 1 Jul 2099, 14:30",
    );
  });
});
