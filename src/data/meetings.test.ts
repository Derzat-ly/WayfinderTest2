import { describe, expect, it } from "vitest";
import { createTestApp } from "@/test/test-app";

async function signedInOrganiser(
  app: Awaited<ReturnType<typeof createTestApp>>,
  { email = "ada@example.com", timezone = "UTC" } = {},
) {
  return app.organiserData(await app.signUp({ name: "Ada", email, timezone }));
}

describe("Meetings", () => {
  it("creates a Meeting with just a title and start, stored as a UTC instant plus a copy of the Organiser's timezone", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app, { timezone: "Europe/London" });

    const created = await data.createMeeting({
      title: "Rehearsal",
      date: "2099-07-01",
      time: "19:30",
    });

    if (!created.ok) throw new Error("create failed");
    expect(await data.meeting(created.meeting.id)).toEqual({
      id: created.meeting.id,
      title: "Rehearsal",
      startAt: new Date("2099-07-01T18:30:00Z"),
      timezone: "Europe/London",
      durationMinutes: null,
      location: null,
      notes: null,
      privateNotes: null,
      attendees: [],
    });
  });

  it("creates a Meeting with every optional detail filled in", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);

    const created = await data.createMeeting({
      title: "  Rehearsal ",
      date: "2099-07-01",
      time: "19:30",
      durationMinutes: "90",
      location: " St Mary's hall ",
      notes: "Bring music",
      privateNotes: "Ask Ben about the fee",
    });

    if (!created.ok) throw new Error("create failed");
    expect(await data.meeting(created.meeting.id)).toMatchObject({
      title: "Rehearsal",
      durationMinutes: 90,
      location: "St Mary's hall",
      notes: "Bring music",
      privateNotes: "Ask Ben about the fee",
    });
  });

  it("refuses a Meeting with no title or no start, saying which, and creates nothing", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);

    const noTitle = await data.createMeeting({
      title: "  ",
      date: "2099-07-01",
      time: "19:30",
    });
    const noDate = await data.createMeeting({
      title: "Rehearsal",
      date: "",
      time: "19:30",
    });
    const noTime = await data.createMeeting({
      title: "Rehearsal",
      date: "2099-07-01",
      time: "",
    });

    expect(noTitle).toEqual({
      ok: false,
      fieldErrors: { title: "Enter a title." },
    });
    expect(noDate).toEqual({
      ok: false,
      fieldErrors: { start: "Enter a date and start time." },
    });
    expect(noTime).toEqual(noDate);
    expect(await data.meetings()).toEqual({ upcoming: [], past: [] });
  });

  it.each(["an hour", "0", "1.5", "-30"])(
    "refuses %j as a duration",
    async (notMinutes) => {
      const app = await createTestApp();
      const data = await signedInOrganiser(app);

      const created = await data.createMeeting({
        title: "Rehearsal",
        date: "2099-07-01",
        time: "19:30",
        durationMinutes: notMinutes,
      });

      expect(created).toEqual({
        ok: false,
        fieldErrors: { durationMinutes: "Enter the duration in whole minutes." },
      });
      expect(await data.meetings()).toEqual({ upcoming: [], past: [] });
    },
  );

  it("lists a Meeting under Upcoming before its start and under Past after it", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app, { timezone: "Europe/London" });
    const past = await data.createMeeting({
      title: "Launch",
      date: "2001-01-10",
      time: "09:00",
      location: "Hall",
    });
    const upcoming = await data.createMeeting({
      title: "Reunion",
      date: "2099-01-10",
      time: "09:00",
    });
    if (!past.ok || !upcoming.ok) throw new Error("setup failed");

    expect(await data.meetings()).toEqual({
      upcoming: [
        {
          id: upcoming.meeting.id,
          title: "Reunion",
          startAt: new Date("2099-01-10T09:00:00Z"),
          timezone: "Europe/London",
          location: null,
          attendeeCount: 0,
        },
      ],
      past: [
        {
          id: past.meeting.id,
          title: "Launch",
          startAt: new Date("2001-01-10T09:00:00Z"),
          timezone: "Europe/London",
          location: "Hall",
          attendeeCount: 0,
        },
      ],
    });
  });

  it("keeps an existing Meeting's time and zone when the Organiser changes timezone, and gives a new Meeting the new zone", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app, { timezone: "Europe/London" });
    const before = await data.createMeeting({
      title: "Rehearsal",
      date: "2099-07-01",
      time: "19:30",
    });
    if (!before.ok) throw new Error("setup failed");

    await data.setTimezone("America/New_York");
    const after = await data.createMeeting({
      title: "Concert",
      date: "2099-07-01",
      time: "19:30",
    });
    if (!after.ok) throw new Error("setup failed");

    expect(await data.meeting(before.meeting.id)).toMatchObject({
      startAt: new Date("2099-07-01T18:30:00Z"),
      timezone: "Europe/London",
    });
    expect(await data.meeting(after.meeting.id)).toMatchObject({
      startAt: new Date("2099-07-01T23:30:00Z"),
      timezone: "America/New_York",
    });
  });
});

describe("Attendees", () => {
  it("makes the Members picked on the New meeting form its Attendees, each added individually", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const ben = await data.addMember({ name: "Ben Ng", email: "ben@x.com" });
    const ann = await data.addMember({ name: "Ann Lee", email: "ann@x.com" });
    if (!ann.ok || !ben.ok) throw new Error("setup failed");

    const created = await data.createMeeting(
      { title: "Rehearsal", date: "2099-07-01", time: "19:30" },
      { memberIds: [ben.member.id, ann.member.id] },
    );

    if (!created.ok) throw new Error("create failed");
    expect((await data.meeting(created.meeting.id))?.attendees).toEqual([
      {
        memberId: ann.member.id,
        name: "Ann Lee",
        email: "ann@x.com",
        addedVia: "individual",
      },
      {
        memberId: ben.member.id,
        name: "Ben Ng",
        email: "ben@x.com",
        addedVia: "individual",
      },
    ]);
    expect((await data.meetings()).upcoming[0].attendeeCount).toBe(2);
  });

  it("adds a Member to an existing Meeting, and removes them again without deleting the Member", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const ann = await data.addMember({ name: "Ann Lee", email: "ann@x.com" });
    const created = await data.createMeeting({
      title: "Rehearsal",
      date: "2099-07-01",
      time: "19:30",
    });
    if (!ann.ok || !created.ok) throw new Error("setup failed");
    const meetingId = created.meeting.id;

    const added = await data.addAttendee(meetingId, ann.member.id);

    expect(added).toEqual({ ok: true });
    expect((await data.meeting(meetingId))?.attendees).toEqual([
      {
        memberId: ann.member.id,
        name: "Ann Lee",
        email: "ann@x.com",
        addedVia: "individual",
      },
    ]);

    await data.removeAttendee(meetingId, ann.member.id);

    expect((await data.meeting(meetingId))?.attendees).toEqual([]);
    expect(await data.members()).toHaveLength(1);
  });

  it("keeps a Member on a Meeting once however many times they are added", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const ann = await data.addMember({ name: "Ann Lee", email: "ann@x.com" });
    if (!ann.ok) throw new Error("setup failed");
    const created = await data.createMeeting(
      { title: "Rehearsal", date: "2099-07-01", time: "19:30" },
      { memberIds: [ann.member.id, ann.member.id] },
    );
    if (!created.ok) throw new Error("create failed");

    const again = await data.addAttendee(created.meeting.id, ann.member.id);

    expect(again).toEqual({ ok: true });
    expect((await data.meeting(created.meeting.id))?.attendees).toHaveLength(1);
    expect((await data.meetings()).upcoming[0].attendeeCount).toBe(1);
  });
});

describe("Meetings across Organisers", () => {
  it("won't open another Organiser's Meeting, so its private notes stay theirs", async () => {
    const app = await createTestApp();
    const ada = await signedInOrganiser(app, { email: "ada@example.com" });
    const grace = await signedInOrganiser(app, { email: "grace@example.com" });
    const adas = await ada.createMeeting({
      title: "Rehearsal",
      date: "2099-07-01",
      time: "19:30",
      privateNotes: "Ask Ben about the fee",
    });
    if (!adas.ok) throw new Error("setup failed");

    expect(await grace.meeting(adas.meeting.id)).toBeUndefined();
    expect(await grace.meetings()).toEqual({ upcoming: [], past: [] });
    expect((await ada.meeting(adas.meeting.id))?.privateNotes).toBe(
      "Ask Ben about the fee",
    );
  });

  it("won't add another Organiser's Member to a Meeting, or anyone to another Organiser's Meeting", async () => {
    const app = await createTestApp();
    const ada = await signedInOrganiser(app, { email: "ada@example.com" });
    const grace = await signedInOrganiser(app, { email: "grace@example.com" });
    const adasAnn = await ada.addMember({ name: "Ann Lee", email: "ann@x.com" });
    const adasMeeting = await ada.createMeeting({
      title: "Rehearsal",
      date: "2099-07-01",
      time: "19:30",
    });
    const gracesBen = await grace.addMember({ name: "Ben Ng", email: "ben@x.com" });
    const gracesMeeting = await grace.createMeeting({
      title: "Concert",
      date: "2099-07-01",
      time: "19:30",
    });
    if (!adasAnn.ok || !adasMeeting.ok || !gracesBen.ok || !gracesMeeting.ok) {
      throw new Error("setup failed");
    }

    const adasMemberOntoOwnMeeting = await grace.addAttendee(
      gracesMeeting.meeting.id,
      adasAnn.member.id,
    );
    const ontoAdasMeeting = await grace.addAttendee(
      adasMeeting.meeting.id,
      gracesBen.member.id,
    );
    const createdWithAdasMember = await grace.createMeeting(
      { title: "Party", date: "2099-08-01", time: "20:00" },
      { memberIds: [gracesBen.member.id, adasAnn.member.id] },
    );

    expect(adasMemberOntoOwnMeeting).toEqual({ ok: false, notFound: true });
    expect(ontoAdasMeeting).toEqual({ ok: false, notFound: true });
    expect(createdWithAdasMember).toEqual({ ok: false, notFound: true });
    expect((await grace.meetings()).upcoming.map((m) => m.title)).toEqual([
      "Concert",
    ]);
    expect((await grace.meeting(gracesMeeting.meeting.id))?.attendees).toEqual(
      [],
    );
    expect((await ada.meeting(adasMeeting.meeting.id))?.attendees).toEqual([]);
  });
});
