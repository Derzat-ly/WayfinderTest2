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

