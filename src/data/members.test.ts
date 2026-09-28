import { describe, expect, it } from "vitest";
import { createTestApp } from "@/test/test-app";

async function signedInOrganiser(
  app: Awaited<ReturnType<typeof createTestApp>>,
  email = "ada@example.com",
) {
  return app.organiserData(await app.signUp({ name: "Ada", email }));
}

describe("Members", () => {
  it("lists a Member the Organiser has added", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);

    const added = await data.addMember({ name: "Ann Lee", email: "ann@x.com" });

    expect(added.ok).toBe(true);
    expect(await data.members()).toEqual([
      {
        id: expect.any(String),
        name: "Ann Lee",
        email: "ann@x.com",
        groups: [],
      },
    ]);
  });

  it.each([
    { details: { name: "", email: "ann@x.com" }, missing: ["name"] },
    { details: { name: "Ann Lee", email: "  " }, missing: ["email"] },
    { details: { name: " ", email: "" }, missing: ["email", "name"] },
  ])(
    "refuses a Member missing $missing, with a message for each",
    async ({ details, missing }) => {
      const app = await createTestApp();
      const data = await signedInOrganiser(app);

      const added = await data.addMember(details);

      expect(added.ok).toBe(false);
      expect(Object.keys(added.ok ? {} : added.fieldErrors ?? {}).sort()).toEqual(
        missing,
      );
      expect(await data.members()).toEqual([]);
    },
  );

  it("refuses to add a second Member with the same email in any case, naming the first", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const ann = await data.addMember({ name: "Ann Lee", email: "Ann@x.com" });
    if (!ann.ok) throw new Error("setup failed");

    const again = await data.addMember({ name: "Annie", email: " ann@X.COM " });

    expect(again).toEqual({
      ok: false,
      duplicateEmail: { id: ann.member.id, name: "Ann Lee" },
    });
    expect(await data.members()).toHaveLength(1);
  });

  it("warns when a Member with the same name exists, and adds them once the Organiser goes ahead", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    await data.addMember({ name: "Ann Lee", email: "ann@x.com" });
    const second = { name: "Ann Lee", email: "ann.lee@y.com" };

    const warned = await data.addMember(second);
    const membersAfterWarning = await data.members();
    const confirmed = await data.addMember(second, { confirmSameName: true });

    expect(warned).toEqual({ ok: false, sameName: true });
    expect(membersAfterWarning).toHaveLength(1);
    expect(confirmed.ok).toBe(true);
    expect((await data.members()).map((m) => m.email).sort()).toEqual([
      "ann.lee@y.com",
      "ann@x.com",
    ]);
  });

  it("edits a Member's name, email, phone and private notes", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const ann = await data.addMember({ name: "Ann Lee", email: "ann@x.com" });
    if (!ann.ok) throw new Error("setup failed");

    const edited = await data.updateMember(ann.member.id, {
      name: "Ann Smith",
      email: "ann.smith@x.com",
      phone: "07700 900123",
      notes: "Prefers mornings",
    });

    expect(edited).toEqual({ ok: true });
    expect(await data.member(ann.member.id)).toEqual({
      id: ann.member.id,
      name: "Ann Smith",
      email: "ann.smith@x.com",
      phone: "07700 900123",
      notes: "Prefers mornings",
      groups: [],
      upcomingMeetings: [],
    });
  });

  it("refuses to edit a Member onto another Member's email in any case, but lets them keep their own", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const ann = await data.addMember({ name: "Ann Lee", email: "ann@x.com" });
    const ben = await data.addMember({ name: "Ben Ng", email: "ben@x.com" });
    if (!ann.ok || !ben.ok) throw new Error("setup failed");
    const noExtras = { phone: "", notes: "" };

    const benAsAnn = await data.updateMember(ben.member.id, {
      name: "Ben Ng",
      email: "ANN@x.com",
      ...noExtras,
    });
    const annRecased = await data.updateMember(ann.member.id, {
      name: "Ann Lee",
      email: "Ann@X.com",
      ...noExtras,
    });

    expect(benAsAnn).toEqual({
      ok: false,
      duplicateEmail: { id: ann.member.id, name: "Ann Lee" },
    });
    expect((await data.member(ben.member.id))?.email).toBe("ben@x.com");
    expect(annRecased).toEqual({ ok: true });
    expect((await data.member(ann.member.id))?.email).toBe("Ann@X.com");
  });

  it("keeps each Organiser's Members to themselves, even when they share an email", async () => {
    const app = await createTestApp();
    const ada = await signedInOrganiser(app, "ada@example.com");
    const grace = await signedInOrganiser(app, "grace@example.com");

    const adasAnn = await ada.addMember({ name: "Ann Lee", email: "ann@x.com" });
    const gracesAnn = await grace.addMember({ name: "Ann", email: "ANN@x.com" });
    if (!adasAnn.ok) throw new Error("setup failed");
    const graceEditsAdasAnn = await grace.updateMember(adasAnn.member.id, {
      name: "Taken over",
      email: "grace-owns@x.com",
      phone: "",
      notes: "",
    });

    expect(gracesAnn.ok).toBe(true);
    expect((await grace.members()).map((m) => m.name)).toEqual(["Ann"]);
    expect(await grace.member(adasAnn.member.id)).toBeUndefined();
    expect(graceEditsAdasAnn).toEqual({ ok: false, notFound: true });
    expect(await ada.member(adasAnn.member.id)).toMatchObject({
      name: "Ann Lee",
      email: "ann@x.com",
    });
  });
});

/** An Organiser whose every `request()` is a fresh request, as a page load is. */
async function organiserMakingRequests(
  app: Awaited<ReturnType<typeof createTestApp>>,
) {
  const headers = await app.signUp({ name: "Ada", email: "ada@example.com" });
  return { request: () => app.organiserData(headers) };
}

describe("Deleting a Member", () => {
  it("tells the Organiser how many Groups and upcoming Meetings the Member will leave", async () => {
    const app = await createTestApp();
    const ada = await organiserMakingRequests(app);
    const setup = await ada.request();
    const choir = await setup.createGroup("Choir");
    const band = await setup.createGroup("Band");
    await setup.createGroup("Board");
    if (!choir.ok || !band.ok) throw new Error("setup failed");
    const ann = await setup.addMember(
      { name: "Ann Lee", email: "ann@x.com" },
      { groupId: choir.group.id },
    );
    if (!ann.ok) throw new Error("setup failed");
    await setup.addToGroup(band.group.id, ann.member.id);
    await setup.createMeeting(
      { title: "Concert", date: "2099-07-01", time: "19:30" },
      { groupIds: [choir.group.id] },
    );
    await setup.createMeeting(
      { title: "Lesson", date: "2099-06-01", time: "10:00" },
      { memberIds: [ann.member.id] },
    );
    await setup.createMeeting(
      { title: "Launch", date: "2001-01-10", time: "09:00" },
      { memberIds: [ann.member.id] },
    );

    const shown = await (await ada.request()).member(ann.member.id);

    expect(shown?.groups).toEqual([
      { id: band.group.id, name: "Band" },
      { id: choir.group.id, name: "Choir" },
    ]);
    expect(shown?.upcomingMeetings).toHaveLength(2);
  });

  it("removes the Member from the Members list, every Group, and every upcoming Meeting, whether added individually or through a copy", async () => {
    const app = await createTestApp();
    const ada = await organiserMakingRequests(app);
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
    if (!ann.ok || !ben.ok) throw new Error("setup failed");
    const lesson = await setup.createMeeting(
      { title: "Lesson", date: "2099-06-01", time: "10:00" },
      { memberIds: [ann.member.id, ben.member.id] },
    );
    const concert = await setup.createMeeting(
      { title: "Concert", date: "2099-07-01", time: "19:30" },
      { groupIds: [choir.group.id] },
    );
    if (!lesson.ok || !concert.ok) throw new Error("setup failed");
    // Removing Ben turns the Choir link into a copy, so Ann is on it as a copy.
    await setup.removeAttendee(concert.meeting.id, ben.member.id, {
      confirmCopy: true,
    });

    const deleted = await (await ada.request()).deleteMember(ann.member.id);
    const after = await ada.request();

    expect(deleted).toEqual({ ok: true });
    expect((await after.members()).map((m) => m.name)).toEqual(["Ben Ng"]);
    expect(await after.member(ann.member.id)).toBeUndefined();
    expect((await after.group(choir.group.id))?.members).toEqual([
      { id: ben.member.id, name: "Ben Ng", email: "ben@x.com" },
    ]);
    expect(
      (await after.meeting(lesson.meeting.id))?.attendees.map((a) => a.name),
    ).toEqual(["Ben Ng"]);
    expect((await after.meeting(concert.meeting.id))?.attendees).toEqual([]);
  });

  it("counts as leaving a Linked Group, so the link on an upcoming Meeting stays live", async () => {
    const app = await createTestApp();
    const ada = await organiserMakingRequests(app);
    const setup = await ada.request();
    const choir = await setup.createGroup("Choir");
    if (!choir.ok) throw new Error("setup failed");
    const ann = await setup.addMember(
      { name: "Ann Lee", email: "ann@x.com" },
      { groupId: choir.group.id },
    );
    await setup.addMember(
      { name: "Ben Ng", email: "ben@x.com" },
      { groupId: choir.group.id },
    );
    if (!ann.ok) throw new Error("setup failed");
    const concert = await setup.createMeeting(
      { title: "Concert", date: "2099-07-01", time: "19:30" },
      { groupIds: [choir.group.id] },
    );
    if (!concert.ok) throw new Error("setup failed");

    await (await ada.request()).deleteMember(ann.member.id);
    const shown = await (await ada.request()).meeting(concert.meeting.id);

    expect(shown?.linkedGroups).toEqual([
      { id: choir.group.id, name: "Choir", kind: "live" },
    ]);
    expect(shown?.attendees).toMatchObject([
      { name: "Ben Ng", addedVia: "linked" },
    ]);
  });

  it("leaves a past Meeting listing them with their details at its start, as a deleted Member", async () => {
    const app = await createTestApp();
    const ada = await organiserMakingRequests(app);
    const setup = await ada.request();
    const ann = await setup.addMember({ name: "Ann Lee", email: "ann@x.com" });
    if (!ann.ok) throw new Error("setup failed");
    const launch = await setup.createMeeting(
      { title: "Launch", date: "2001-01-10", time: "09:00" },
      { memberIds: [ann.member.id] },
    );
    if (!launch.ok) throw new Error("setup failed");
    const later = await ada.request();
    await later.updateMember(ann.member.id, {
      name: "Ann Lee-Smith",
      email: "ann.smith@x.com",
      phone: "",
      notes: "",
    });

    await later.deleteMember(ann.member.id);
    const shown = await (await ada.request()).meeting(launch.meeting.id);

    expect(shown).toMatchObject({
      started: true,
      attendees: [
        {
          memberId: null,
          name: "Ann Lee",
          email: "ann@x.com",
          addedVia: "individual",
        },
      ],
    });
  });

  it("frees the Member's email for a new Member straight away", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const ann = await data.addMember({ name: "Ann Lee", email: "ann@x.com" });
    if (!ann.ok) throw new Error("setup failed");

    await data.deleteMember(ann.member.id);
    const readded = await data.addMember({ name: "Ann Lee", email: "Ann@x.com" });

    expect(readded.ok).toBe(true);
    expect((await data.members()).map((m) => m.email)).toEqual(["Ann@x.com"]);
  });

  it("won't delete another Organiser's Member", async () => {
    const app = await createTestApp();
    const ada = await signedInOrganiser(app, "ada@example.com");
    const grace = await signedInOrganiser(app, "grace@example.com");
    const adasAnn = await ada.addMember({ name: "Ann Lee", email: "ann@x.com" });
    if (!adasAnn.ok) throw new Error("setup failed");

    const graceDeletes = await grace.deleteMember(adasAnn.member.id);

    expect(graceDeletes).toEqual({ ok: false, notFound: true });
    expect((await ada.members()).map((m) => m.name)).toEqual(["Ann Lee"]);
  });
});

describe("A Member's upcoming Meetings", () => {
  it("lists the upcoming Meetings a Member is on, individually or through a Linked Group, leaving out past ones", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const choir = await data.createGroup("Choir");
    if (!choir.ok) throw new Error("setup failed");
    const ann = await data.addMember(
      { name: "Ann Lee", email: "ann@x.com" },
      { groupId: choir.group.id },
    );
    if (!ann.ok) throw new Error("setup failed");
    const concert = await data.createMeeting(
      { title: "Concert", date: "2099-07-01", time: "19:30" },
      { groupIds: [choir.group.id] },
    );
    const lesson = await data.createMeeting(
      { title: "Lesson", date: "2099-06-01", time: "10:00" },
      { memberIds: [ann.member.id] },
    );
    await data.createMeeting(
      { title: "Launch", date: "2001-01-10", time: "09:00" },
      { memberIds: [ann.member.id], groupIds: [choir.group.id] },
    );
    await data.createMeeting({
      title: "Board",
      date: "2099-08-01",
      time: "09:00",
    });
    if (!concert.ok || !lesson.ok) throw new Error("setup failed");

    expect((await data.member(ann.member.id))?.upcomingMeetings).toEqual([
      {
        id: lesson.meeting.id,
        title: "Lesson",
        startAt: new Date("2099-06-01T10:00:00Z"),
        timezone: "UTC",
      },
      {
        id: concert.meeting.id,
        title: "Concert",
        startAt: new Date("2099-07-01T19:30:00Z"),
        timezone: "UTC",
      },
    ]);
  });
});

