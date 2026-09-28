import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "@/test/test-app";

// The horizon is 90 days, so it reaches 2030-04-01T09:00Z from here.
const NOW = new Date("2030-01-01T09:00:00Z");

beforeEach(() => {
  // Only Date: libsql's async I/O still needs real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/** An Organiser whose every `request()` is a fresh request, as a page load is. */
async function signedInOrganiser({ timezone = "UTC" } = {}) {
  const app = await createTestApp();
  const headers = await app.signUp({
    name: "Ada",
    email: "ada@example.com",
    timezone,
  });
  return { app, request: () => app.organiserData(headers) };
}

describe("Meeting Series", () => {
  it("creates every Meeting of a daily Series that starts within the horizon", async () => {
    const ada = await signedInOrganiser();

    const created = await (await ada.request()).createMeeting({
      title: "Rehearsal",
      date: "2030-01-01",
      time: "10:00",
      repeatUnit: "day",
      repeatEvery: "3",
    });

    if (!created.ok) throw new Error("create failed");
    const { upcoming } = await (await ada.request()).meetings();
    // Every third day from 1 January to 29 March.
    expect(upcoming).toHaveLength(30);
    expect(upcoming[0]).toMatchObject({
      id: created.meeting.id,
      title: "Rehearsal",
      startAt: new Date("2030-01-01T10:00:00Z"),
    });
    expect(upcoming[29]).toMatchObject({
      title: "Rehearsal",
      startAt: new Date("2030-03-29T10:00:00Z"),
    });
  });

  it("creates the first Meeting of a Series even when it starts beyond the horizon", async () => {
    const ada = await signedInOrganiser();

    await (await ada.request()).createMeeting({
      title: "AGM",
      date: "2030-07-02",
      time: "19:00",
      repeatUnit: "week",
      repeatEvery: "1",
    });

    expect((await (await ada.request()).meetings()).upcoming).toMatchObject([
      { title: "AGM", startAt: new Date("2030-07-02T19:00:00Z") },
    ]);
  });

  it("gives each Meeting a copy of the Series' details and Attendee choices, keeping Group links live", async () => {
    const ada = await signedInOrganiser();
    const setup = await ada.request();
    const choir = await setup.createGroup("Choir");
    if (!choir.ok) throw new Error("setup failed");
    const ann = await setup.addMember(
      { name: "Ann Lee", email: "ann@x.com" },
      { groupId: choir.group.id },
    );
    const ben = await setup.addMember({ name: "Ben Ng", email: "ben@x.com" });
    const cat = await setup.addMember({ name: "Cat Roe", email: "cat@x.com" });
    if (!ann.ok || !ben.ok || !cat.ok) throw new Error("setup failed");
    await setup.createMeeting(
      {
        title: "Rehearsal",
        date: "2030-01-01",
        time: "10:00",
        durationMinutes: "90",
        location: "St Mary's hall",
        notes: "Bring music",
        privateNotes: "Ask Ben about the fee",
        repeatUnit: "week",
        repeatEvery: "4",
      },
      { memberIds: [ben.member.id], groupIds: [choir.group.id] },
    );

    await (await ada.request()).addToGroup(choir.group.id, cat.member.id);

    const later = await ada.request();
    const { upcoming } = await later.meetings();
    expect(upcoming).toHaveLength(4);
    for (const { id } of upcoming) {
      expect(await later.meeting(id)).toMatchObject({
        title: "Rehearsal",
        durationMinutes: 90,
        location: "St Mary's hall",
        notes: "Bring music",
        privateNotes: "Ask Ben about the fee",
        linkedGroups: [{ id: choir.group.id, name: "Choir", kind: "live" }],
        attendees: [
          { name: "Ann Lee", addedVia: "linked" },
          { name: "Ben Ng", addedVia: "individual" },
          { name: "Cat Roe", addedVia: "linked" },
        ],
      });
    }
  });

  it("adds Meetings as time passes, finalising those that fell due while the app was off in the same pass", async () => {
    const ada = await signedInOrganiser();
    const setup = await ada.request();
    const ann = await setup.addMember({ name: "Ann Lee", email: "ann@x.com" });
    if (!ann.ok) throw new Error("setup failed");
    // Every 140 days, so only the first Meeting is within the horizon today.
    await setup.createMeeting(
      {
        title: "Review",
        date: "2030-01-01",
        time: "10:00",
        repeatUnit: "week",
        repeatEvery: "20",
      },
      { memberIds: [ann.member.id] },
    );
    expect((await setup.meetings()).upcoming).toHaveLength(1);

    // Nothing runs while the app is off; months later Ada signs in again.
    vi.setSystemTime(new Date("2030-12-01T09:00:00Z"));
    const later = await ada.app.organiserData(
      await ada.app.signIn("ada@example.com"),
    );
    await later.updateMember(ann.member.id, {
      name: "Ann Lee-Smith",
      email: "ann@x.com",
      phone: "",
      notes: "",
    });

    const { upcoming, past } = await later.meetings();
    expect(upcoming).toMatchObject([
      { startAt: new Date("2031-02-25T10:00:00Z") },
    ]);
    expect(past).toMatchObject([
      { startAt: new Date("2030-10-08T10:00:00Z") },
      { startAt: new Date("2030-05-21T10:00:00Z") },
      { startAt: new Date("2030-01-01T10:00:00Z") },
    ]);
    for (const { id } of past) {
      expect(await later.meeting(id)).toMatchObject({
        started: true,
        attendees: [{ name: "Ann Lee" }],
      });
    }
  });

  it("never creates a Meeting twice when catch-up runs again", async () => {
    const ada = await signedInOrganiser();
    await (await ada.request()).createMeeting({
      title: "Rehearsal",
      date: "2030-01-01",
      time: "10:00",
      repeatUnit: "day",
      repeatEvery: "1",
    });

    // Six more days come into the horizon; two page loads follow each other.
    vi.setSystemTime(new Date("2030-01-07T09:00:00Z"));
    await ada.request();
    const second = await ada.request();

    const { upcoming, past } = await second.meetings();
    const starts = [...past, ...upcoming].map((m) => m.startAt.getTime());
    expect(new Set(starts).size).toBe(starts.length);
    // 1 January to 6 April.
    expect(starts).toHaveLength(96);
  });

  it("marks the Meetings of a Series on Meetings home, and not a one-off Meeting", async () => {
    const ada = await signedInOrganiser();
    const setup = await ada.request();
    await setup.createMeeting({
      title: "Rehearsal",
      date: "2030-01-01",
      time: "10:00",
      repeatUnit: "week",
      repeatEvery: "6",
    });
    await setup.createMeeting({
      title: "Concert",
      date: "2030-01-02",
      time: "19:00",
    });

    expect((await (await ada.request()).meetings()).upcoming).toMatchObject([
      { title: "Rehearsal", inSeries: true },
      { title: "Concert", inSeries: false },
      { title: "Rehearsal", inSeries: true },
      { title: "Rehearsal", inSeries: true },
    ]);
  });

  it("changes only the Meeting whose Attendees are changed, and marks it as changed", async () => {
    const ada = await signedInOrganiser();
    const setup = await ada.request();
    const choir = await setup.createGroup("Choir");
    if (!choir.ok) throw new Error("setup failed");
    const ann = await setup.addMember({ name: "Ann Lee", email: "ann@x.com" });
    const bea = await setup.addMember(
      { name: "Bea Cho", email: "bea@x.com" },
      { groupId: choir.group.id },
    );
    const cat = await setup.addMember({ name: "Cat Roe", email: "cat@x.com" });
    if (!ann.ok || !bea.ok || !cat.ok) throw new Error("setup failed");
    await setup.createMeeting(
      {
        title: "Rehearsal",
        date: "2030-01-01",
        time: "10:00",
        repeatUnit: "week",
        repeatEvery: "3",
      },
      { memberIds: [ann.member.id], groupIds: [choir.group.id] },
    );
    const ids = (await setup.meetings()).upcoming.map((m) => m.id);

    const changing = await ada.request();
    await changing.addAttendee(ids[1], cat.member.id);
    // Choir on this one becomes a copy of the rest of it.
    await changing.removeAttendee(ids[2], bea.member.id, { confirmCopy: true });

    const later = await ada.request();
    expect((await later.meetings()).upcoming.map((m) => m.changed)).toEqual([
      false,
      true,
      true,
      false,
      false,
    ]);
    const names = async (id: string) =>
      (await later.meeting(id))?.attendees.map((a) => a.name);
    expect(await names(ids[0])).toEqual(["Ann Lee", "Bea Cho"]);
    expect(await names(ids[1])).toEqual(["Ann Lee", "Bea Cho", "Cat Roe"]);
    expect(await names(ids[2])).toEqual(["Ann Lee"]);
    expect(await names(ids[3])).toEqual(["Ann Lee", "Bea Cho"]);
  });

  it("says on a Meeting that it belongs to a Series, with the repeat rule in words", async () => {
    const ada = await signedInOrganiser({ timezone: "Europe/London" });
    const setup = await ada.request();
    const created = await setup.createMeeting({
      title: "Rehearsal",
      date: "2030-01-01",
      time: "19:30",
      repeatUnit: "week",
      repeatEvery: "2",
    });
    const oneOff = await setup.createMeeting({
      title: "Concert",
      date: "2030-01-02",
      time: "19:00",
    });
    if (!created.ok || !oneOff.ok) throw new Error("setup failed");

    const later = await ada.request();
    expect((await later.meeting(created.meeting.id))?.series).toEqual({
      repeats: "Every 2 weeks on Tuesday",
    });
    expect((await later.meeting(oneOff.meeting.id))?.series).toBeNull();
  });

  it("refuses a repeat that isn't every whole number of days or weeks, and creates nothing", async () => {
    const ada = await signedInOrganiser();
    const data = await ada.request();

    for (const repeatEvery of ["", "0", "2.5", "two"]) {
      expect(
        await data.createMeeting({
          title: "Rehearsal",
          date: "2030-01-01",
          time: "10:00",
          repeatUnit: "week",
          repeatEvery,
        }),
      ).toEqual({
        ok: false,
        fieldErrors: { repeatEvery: "Enter how many days or weeks apart, as a whole number." },
      });
    }
    expect((await (await ada.request()).meetings()).upcoming).toEqual([]);
  });
});
