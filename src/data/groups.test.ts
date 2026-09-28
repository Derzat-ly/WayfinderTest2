import { describe, expect, it } from "vitest";
import { createTestApp } from "@/test/test-app";

async function signedInOrganiser(
  app: Awaited<ReturnType<typeof createTestApp>>,
  email = "ada@example.com",
) {
  return app.organiserData(await app.signUp({ name: "Ada", email }));
}

describe("Groups", () => {
  it("lists a Group the Organiser has created, with no Members yet", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);

    const created = await data.createGroup("Choir");

    expect(created.ok).toBe(true);
    expect(await data.groups()).toEqual([
      { id: expect.any(String), name: "Choir", memberCount: 0, upcomingMeetingCount: 0 },
    ]);
  });

  it("refuses a Group with a blank name", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);

    const created = await data.createGroup("   ");

    expect(created).toEqual({
      ok: false,
      fieldErrors: { name: "Enter a name." },
    });
    expect(await data.groups()).toEqual([]);
  });

  it("adds an existing Member to a Group, who then shows on the Group page and in its count", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const choir = await data.createGroup("Choir");
    const ann = await data.addMember({ name: "Ann Lee", email: "ann@x.com" });
    if (!choir.ok || !ann.ok) throw new Error("setup failed");

    const added = await data.addToGroup(choir.group.id, ann.member.id);

    expect(added.ok).toBe(true);
    expect(await data.group(choir.group.id)).toEqual({
      id: choir.group.id,
      name: "Choir",
      members: [{ id: ann.member.id, name: "Ann Lee", email: "ann@x.com" }],
      upcomingMeetings: [],
    });
    expect(await data.groups()).toEqual([
      { id: choir.group.id, name: "Choir", memberCount: 1, upcomingMeetingCount: 0 },
    ]);
  });

  it("treats adding a Member already in the Group as done, keeping them in it once", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const choir = await data.createGroup("Choir");
    const ann = await data.addMember({ name: "Ann Lee", email: "ann@x.com" });
    if (!choir.ok || !ann.ok) throw new Error("setup failed");
    await data.addToGroup(choir.group.id, ann.member.id);

    const again = await data.addToGroup(choir.group.id, ann.member.id);

    expect(again).toEqual({ ok: true });
    expect((await data.groups())[0].memberCount).toBe(1);
  });

  it("removes a Member from a Group without deleting the Member", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const choir = await data.createGroup("Choir");
    const ann = await data.addMember({ name: "Ann Lee", email: "ann@x.com" });
    if (!choir.ok || !ann.ok) throw new Error("setup failed");
    await data.addToGroup(choir.group.id, ann.member.id);

    await data.removeFromGroup(choir.group.id, ann.member.id);

    expect((await data.group(choir.group.id))?.members).toEqual([]);
    expect(await data.members()).toHaveLength(1);
  });

  it("adds a new Member straight into a Group", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const choir = await data.createGroup("Choir");
    if (!choir.ok) throw new Error("setup failed");

    const added = await data.addMember(
      { name: "Ann Lee", email: "ann@x.com" },
      { groupId: choir.group.id },
    );

    expect(added.ok).toBe(true);
    expect((await data.group(choir.group.id))?.members).toEqual([
      { id: expect.any(String), name: "Ann Lee", email: "ann@x.com" },
    ]);
  });

  it("refuses a new Member with an email already in use, naming the existing Member and leaving the Group as it was", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const choir = await data.createGroup("Choir");
    const ann = await data.addMember({ name: "Ann Lee", email: "ann@x.com" });
    if (!choir.ok || !ann.ok) throw new Error("setup failed");

    const again = await data.addMember(
      { name: "Annie", email: "ANN@x.com" },
      { groupId: choir.group.id },
    );

    expect(again).toEqual({
      ok: false,
      duplicateEmail: { id: ann.member.id, name: "Ann Lee" },
    });
    expect((await data.group(choir.group.id))?.members).toEqual([]);
  });

  it("offers every Group on the Member page, ticked where the Member is in it, and ticking one shows on the Group page", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const choir = await data.createGroup("Choir");
    const band = await data.createGroup("Band");
    const ann = await data.addMember({ name: "Ann Lee", email: "ann@x.com" });
    if (!choir.ok || !band.ok || !ann.ok) throw new Error("setup failed");

    await data.addToGroup(band.group.id, ann.member.id);

    expect(await data.groupChoicesFor(ann.member.id)).toEqual([
      { id: band.group.id, name: "Band", isMember: true },
      { id: choir.group.id, name: "Choir", isMember: false },
    ]);
    expect((await data.group(band.group.id))?.members).toEqual([
      { id: ann.member.id, name: "Ann Lee", email: "ann@x.com" },
    ]);
  });

  it("lists each Member's Groups on the Members page, since a Member can be in several", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const choir = await data.createGroup("Choir");
    const band = await data.createGroup("Band");
    const ann = await data.addMember({ name: "Ann Lee", email: "ann@x.com" });
    const ben = await data.addMember({ name: "Ben Ng", email: "ben@x.com" });
    if (!choir.ok || !band.ok || !ann.ok || !ben.ok) {
      throw new Error("setup failed");
    }

    await data.addToGroup(choir.group.id, ann.member.id);
    await data.addToGroup(band.group.id, ann.member.id);

    expect(await data.members()).toEqual([
      {
        id: ann.member.id,
        name: "Ann Lee",
        email: "ann@x.com",
        groups: [
          { id: band.group.id, name: "Band" },
          { id: choir.group.id, name: "Choir" },
        ],
      },
      { id: ben.member.id, name: "Ben Ng", email: "ben@x.com", groups: [] },
    ]);
  });

  it("keeps each Organiser's Groups to themselves, and won't link across Organisers", async () => {
    const app = await createTestApp();
    const ada = await signedInOrganiser(app, "ada@example.com");
    const grace = await signedInOrganiser(app, "grace@example.com");
    const adasChoir = await ada.createGroup("Choir");
    const adasAnn = await ada.addMember({ name: "Ann Lee", email: "ann@x.com" });
    const gracesBand = await grace.createGroup("Band");
    const gracesBen = await grace.addMember({ name: "Ben Ng", email: "ben@x.com" });
    if (!adasChoir.ok || !adasAnn.ok || !gracesBand.ok || !gracesBen.ok) {
      throw new Error("setup failed");
    }

    const intoAdasGroup = await grace.addToGroup(
      adasChoir.group.id,
      gracesBen.member.id,
    );
    const adasMemberIntoOwnGroup = await grace.addToGroup(
      gracesBand.group.id,
      adasAnn.member.id,
    );

    expect(intoAdasGroup).toEqual({ ok: false, notFound: true });
    expect(adasMemberIntoOwnGroup).toEqual({ ok: false, notFound: true });
    expect(await grace.group(adasChoir.group.id)).toBeUndefined();
    expect((await grace.groups()).map((g) => g.name)).toEqual(["Band"]);
    expect(await ada.groups()).toEqual([
      { id: adasChoir.group.id, name: "Choir", memberCount: 0, upcomingMeetingCount: 0 },
    ]);
  });

  it("won't add a new Member into another Organiser's Group, and adds no Member either", async () => {
    const app = await createTestApp();
    const ada = await signedInOrganiser(app, "ada@example.com");
    const grace = await signedInOrganiser(app, "grace@example.com");
    const adasChoir = await ada.createGroup("Choir");
    if (!adasChoir.ok) throw new Error("setup failed");

    const added = await grace.addMember(
      { name: "Ben Ng", email: "ben@x.com" },
      { groupId: adasChoir.group.id },
    );

    expect(added).toEqual({ ok: false, notFound: true });
    expect(await grace.members()).toEqual([]);
  });
});

describe("Groups linked to Meetings", () => {
  it("counts and lists the upcoming Meetings linking a Group, leaving out past ones", async () => {
    const app = await createTestApp();
    const data = await signedInOrganiser(app);
    const choir = await data.createGroup("Choir");
    const upcoming = await data.createMeeting(
      { title: "Concert", date: "2099-07-01", time: "19:30" },
      { groupIds: choir.ok ? [choir.group.id] : [] },
    );
    const past = await data.createMeeting(
      { title: "Launch", date: "2001-01-10", time: "09:00" },
      { groupIds: choir.ok ? [choir.group.id] : [] },
    );
    const unlinked = await data.createMeeting({
      title: "Rehearsal",
      date: "2099-06-01",
      time: "19:30",
    });
    if (!choir.ok || !upcoming.ok || !past.ok || !unlinked.ok) {
      throw new Error("setup failed");
    }

    expect(await data.groups()).toEqual([
      {
        id: choir.group.id,
        name: "Choir",
        memberCount: 0,
        upcomingMeetingCount: 1,
      },
    ]);
    expect((await data.group(choir.group.id))?.upcomingMeetings).toEqual([
      {
        id: upcoming.meeting.id,
        title: "Concert",
        startAt: new Date("2099-07-01T19:30:00Z"),
        timezone: "UTC",
      },
    ]);
  });
});

