import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { meeting, memberGroup } from "@/db/schema";
import { createTestApp } from "@/test/test-app";

// Meetings are set up at 10:00 UTC on this day, an hour after "now".
const NOW = new Date("2030-01-01T09:00:00Z");
const AFTER_START = new Date("2030-01-01T11:00:00Z");

beforeEach(() => {
  // Only Date: libsql's async I/O still needs real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/** An Organiser whose every `request()` is a fresh request, as a page load is. */
async function signedInOrganiser(
  app: Awaited<ReturnType<typeof createTestApp>>,
  { email = "ada@example.com" } = {},
) {
  const headers = await app.signUp({ name: "Ada", email, timezone: "UTC" });
  return { request: () => app.organiserData(headers) };
}

async function meetingAtTen(
  data: Awaited<ReturnType<Awaited<ReturnType<typeof createTestApp>>["organiserData"]>>,
  choices: { memberIds?: string[]; groupIds?: string[] } = {},
) {
  const created = await data.createMeeting(
    { title: "Rehearsal", date: "2030-01-01", time: "10:00" },
    choices,
  );
  if (!created.ok) throw new Error("setup failed");
  return created.meeting.id;
}

describe("Lazy catch-up", () => {
  it("finalises a Meeting on the first request after its start, keeping each Attendee's details as they were", async () => {
    const app = await createTestApp();
    const ada = await signedInOrganiser(app);
    const setup = await ada.request();
    const ann = await setup.addMember({ name: "Ann Lee", email: "ann@x.com" });
    if (!ann.ok) throw new Error("setup failed");
    const meetingId = await meetingAtTen(setup, { memberIds: [ann.member.id] });

    vi.setSystemTime(AFTER_START);
    const later = await ada.request();
    await later.updateMember(ann.member.id, {
      name: "Ann Lee-Smith",
      email: "ann.smith@x.com",
      phone: "",
      notes: "",
    });

    expect(await later.meeting(meetingId)).toMatchObject({
      started: true,
      attendees: [
        {
          memberId: ann.member.id,
          name: "Ann Lee",
          email: "ann@x.com",
          addedVia: "individual",
        },
      ],
    });
  });

  it("freezes a started Meeting's Linked Groups: Members joining or leaving, or a rename, no longer reach it", async () => {
    const app = await createTestApp();
    const ada = await signedInOrganiser(app);
    const setup = await ada.request();
    const choir = await setup.createGroup("Choir");
    if (!choir.ok) throw new Error("setup failed");
    const ann = await setup.addMember(
      { name: "Ann Lee", email: "ann@x.com" },
      { groupId: choir.group.id },
    );
    const ben = await setup.addMember(
      { name: "Ben Ng", email: "ben@x.com" },
      { groupId: choir.group.id },
    );
    const cat = await setup.addMember({ name: "Cat Roe", email: "cat@x.com" });
    if (!ann.ok || !ben.ok || !cat.ok) throw new Error("setup failed");
    const meetingId = await meetingAtTen(setup, { groupIds: [choir.group.id] });

    vi.setSystemTime(AFTER_START);
    const later = await ada.request();
    await later.removeFromGroup(choir.group.id, ben.member.id);
    await later.addToGroup(choir.group.id, cat.member.id);
    // No rename in the app yet, so rename the Group underneath it.
    await app.db
      .update(memberGroup)
      .set({ name: "Chorus" })
      .where(eq(memberGroup.id, choir.group.id));

    const shown = await (await ada.request()).meeting(meetingId);
    expect(shown?.linkedGroups).toEqual([
      { id: choir.group.id, name: "Choir", kind: "live" },
    ]);
    expect(shown?.attendees).toEqual([
      {
        memberId: ann.member.id,
        name: "Ann Lee",
        email: "ann@x.com",
        addedVia: "linked",
        group: { id: choir.group.id, name: "Choir" },
      },
      {
        memberId: ben.member.id,
        name: "Ben Ng",
        email: "ben@x.com",
        addedVia: "linked",
        group: { id: choir.group.id, name: "Choir" },
      },
    ]);
  });

  it("records how each Attendee was added, taking individual, then copy, then linked when several apply", async () => {
    const app = await createTestApp();
    const ada = await signedInOrganiser(app);
    const setup = await ada.request();
    const choir = await setup.createGroup("Choir");
    const altos = await setup.createGroup("Altos");
    if (!choir.ok || !altos.ok) throw new Error("setup failed");
    const ids: Record<string, string> = {};
    for (const [name, groupIds] of [
      ["Ann Lee", [choir.group.id]],
      ["Ben Ng", [choir.group.id, altos.group.id]],
      ["Cat Roe", [choir.group.id, altos.group.id]],
      ["Dan Wu", [altos.group.id]],
    ] as const) {
      const added = await setup.addMember({
        name,
        email: `${name.split(" ")[0].toLowerCase()}@x.com`,
      });
      if (!added.ok) throw new Error("setup failed");
      ids[name] = added.member.id;
      for (const groupId of groupIds) await setup.addToGroup(groupId, added.member.id);
    }
    const meetingId = await meetingAtTen(setup, {
      memberIds: [ids["Ben Ng"]],
      groupIds: [choir.group.id, altos.group.id],
    });
    // Choir becomes a copy of Ben and Cat; Altos stays linked.
    await setup.removeAttendee(meetingId, ids["Ann Lee"], { confirmCopy: true });

    vi.setSystemTime(AFTER_START);
    const shown = await (await ada.request()).meeting(meetingId);

    expect(shown?.attendees).toEqual([
      {
        memberId: ids["Ben Ng"],
        name: "Ben Ng",
        email: "ben@x.com",
        addedVia: "individual",
      },
      {
        memberId: ids["Cat Roe"],
        name: "Cat Roe",
        email: "cat@x.com",
        addedVia: "copy",
        group: { id: choir.group.id, name: "Choir" },
      },
      {
        memberId: ids["Dan Wu"],
        name: "Dan Wu",
        email: "dan@x.com",
        addedVia: "linked",
        group: { id: altos.group.id, name: "Altos" },
      },
    ]);
  });

  it("finalises Meetings that started while the app was off, once, with the Attendees they had at their start", async () => {
    const app = await createTestApp();
    const ada = await signedInOrganiser(app);
    const setup = await ada.request();
    const choir = await setup.createGroup("Choir");
    if (!choir.ok) throw new Error("setup failed");
    const ann = await setup.addMember(
      { name: "Ann Lee", email: "ann@x.com" },
      { groupId: choir.group.id },
    );
    const ben = await setup.addMember({ name: "Ben Ng", email: "ben@x.com" });
    if (!ann.ok || !ben.ok) throw new Error("setup failed");
    const rehearsal = await meetingAtTen(setup, {
      memberIds: [ben.member.id],
      groupIds: [choir.group.id],
    });
    const concert = await setup.createMeeting(
      { title: "Concert", date: "2030-01-01", time: "10:30" },
      { groupIds: [choir.group.id] },
    );
    if (!concert.ok) throw new Error("setup failed");
    const atStart = {
      rehearsal: (await setup.meeting(rehearsal))?.attendees,
      concert: (await setup.meeting(concert.meeting.id))?.attendees,
    };

    // Nothing runs while the app is off; then two requests come in.
    vi.setSystemTime(AFTER_START);
    await ada.request();
    const second = await ada.request();

    expect((await second.meeting(rehearsal))?.attendees).toEqual(
      atStart.rehearsal,
    );
    expect((await second.meeting(concert.meeting.id))?.attendees).toEqual(
      atStart.concert,
    );
    expect((await second.meetings()).past).toMatchObject([
      { title: "Concert", attendeeCount: 1 },
      { title: "Rehearsal", attendeeCount: 2 },
    ]);
  });

  it("lists a started Meeting on the Past tab from its fixed record", async () => {
    const app = await createTestApp();
    const ada = await signedInOrganiser(app);
    const setup = await ada.request();
    const choir = await setup.createGroup("Choir");
    if (!choir.ok) throw new Error("setup failed");
    await setup.addMember(
      { name: "Ann Lee", email: "ann@x.com" },
      { groupId: choir.group.id },
    );
    await meetingAtTen(setup, { groupIds: [choir.group.id] });

    vi.setSystemTime(AFTER_START);
    const later = await ada.request();
    await later.addMember(
      { name: "Ben Ng", email: "ben@x.com" },
      { groupId: choir.group.id },
    );
    await app.db
      .update(memberGroup)
      .set({ name: "Chorus" })
      .where(eq(memberGroup.id, choir.group.id));

    expect((await (await ada.request()).meetings()).past).toMatchObject([
      { title: "Rehearsal", attendeeCount: 1, linkedGroupNames: ["Choir"] },
    ]);
  });

  it("only catches up the signed-in Organiser's Meetings", async () => {
    const app = await createTestApp();
    const ada = await signedInOrganiser(app, { email: "ada@example.com" });
    const grace = await signedInOrganiser(app, { email: "grace@example.com" });
    const adas = await meetingAtTen(await ada.request());
    const graces = await meetingAtTen(await grace.request());

    vi.setSystemTime(AFTER_START);
    await grace.request();

    // Unobservable through Ada's data, since her own next request catches up.
    expect(await finalisedAt(app, adas)).toBeNull();
    expect(await finalisedAt(app, graces)).toEqual(AFTER_START);
  });
});

async function finalisedAt(
  app: Awaited<ReturnType<typeof createTestApp>>,
  meetingId: string,
) {
  const [row] = await app.db
    .select({ finalisedAt: meeting.finalisedAt })
    .from(meeting)
    .where(eq(meeting.id, meetingId));
  return row.finalisedAt;
}
