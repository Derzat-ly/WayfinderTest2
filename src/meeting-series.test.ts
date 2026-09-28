import { describe, expect, it } from "vitest";
import { describeRepeat, occurrenceStart } from "@/meeting-series";

describe("occurrenceStart(series, n)", () => {
  it("puts occurrence n of an every-3-days Series 3n days after the first", () => {
    const series = {
      anchorStartAt: new Date("2030-01-01T10:00:00Z"),
      timezone: "UTC",
      intervalUnit: "day" as const,
      intervalCount: 3,
    };

    expect(occurrenceStart(series, 0)).toEqual(new Date("2030-01-01T10:00:00Z"));
    expect(occurrenceStart(series, 2)).toEqual(new Date("2030-01-07T10:00:00Z"));
    expect(occurrenceStart(series, 11)).toEqual(new Date("2030-02-03T10:00:00Z"));
  });

  it("keeps a weekly 09:00 London Series at 09:00 local as the clocks go forward", () => {
    // Tuesday 19 March 2030, GMT; the clocks go forward on Sunday 31 March.
    const series = {
      anchorStartAt: new Date("2030-03-19T09:00:00Z"),
      timezone: "Europe/London",
      intervalUnit: "week" as const,
      intervalCount: 1,
    };

    expect(occurrenceStart(series, 1)).toEqual(new Date("2030-03-26T09:00:00Z"));
    expect(occurrenceStart(series, 2)).toEqual(new Date("2030-04-02T08:00:00Z"));
  });

  it("keeps a fortnightly 09:00 London Series at 09:00 local as the clocks go back", () => {
    // Tuesday 15 October 2030, BST; the clocks go back on Sunday 27 October.
    const series = {
      anchorStartAt: new Date("2030-10-15T08:00:00Z"),
      timezone: "Europe/London",
      intervalUnit: "week" as const,
      intervalCount: 2,
    };

    expect(occurrenceStart(series, 1)).toEqual(new Date("2030-10-29T09:00:00Z"));
  });
});

describe("describeRepeat(series)", () => {
  // Tuesday 1 January 2030 at 23:30 UTC, which is already Wednesday in Auckland.
  const anchorStartAt = new Date("2030-01-01T23:30:00Z");

  it("says how often a daily Series repeats", () => {
    const daily = { anchorStartAt, timezone: "UTC", intervalUnit: "day" as const };

    expect(describeRepeat({ ...daily, intervalCount: 1 })).toBe("Every day");
    expect(describeRepeat({ ...daily, intervalCount: 3 })).toBe("Every 3 days");
  });

  it("names a weekly Series' weekday as the Series' own timezone reads it", () => {
    const weekly = { anchorStartAt, intervalUnit: "week" as const };

    expect(describeRepeat({ ...weekly, timezone: "UTC", intervalCount: 1 })).toBe(
      "Every week on Tuesday",
    );
    expect(
      describeRepeat({ ...weekly, timezone: "Pacific/Auckland", intervalCount: 2 }),
    ).toBe("Every 2 weeks on Wednesday");
  });
});
