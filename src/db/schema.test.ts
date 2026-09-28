import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  groupMembership,
  meetingLinkedGroup,
  meetingMember,
  user,
} from "@/db/schema";
import { createTestApp } from "@/test/test-app";

describe("the database schema", () => {
  it("refuses a Group membership between one Organiser's Group and another's Member", async () => {
    const app = await createTestApp();
    const ada = await app.organiserData(
      await app.signUp({ name: "Ada", email: "ada@example.com" }),
    );
    const grace = await app.organiserData(
      await app.signUp({ name: "Grace", email: "grace@example.com" }),
    );
    const adasChoir = await ada.createGroup("Choir");
    const gracesMember = await grace.addMember({
      name: "Ann Lee",
      email: "ann@x.com",
    });
    if (!adasChoir.ok || !gracesMember.ok) throw new Error("setup failed");
    const [{ id: adaId }] = await app.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, "ada@example.com"));

    const insert = app.db.insert(groupMembership).values({
      organiserId: adaId,
      groupId: adasChoir.group.id,
      memberId: gracesMember.member.id,
    });

    await expect(insert).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining("FOREIGN KEY constraint failed"),
      }),
    });
    expect(await app.db.select().from(groupMembership)).toEqual([]);
  });

  it("refuses an Attendee choice between one Organiser's Meeting and another's Member", async () => {
    const app = await createTestApp();
    const ada = await app.organiserData(
      await app.signUp({ name: "Ada", email: "ada@example.com" }),
    );
    const grace = await app.organiserData(
      await app.signUp({ name: "Grace", email: "grace@example.com" }),
    );
    const adasMeeting = await ada.createMeeting({
      title: "Rehearsal",
      date: "2099-07-01",
      time: "19:30",
    });
    const gracesMember = await grace.addMember({
      name: "Ann Lee",
      email: "ann@x.com",
    });
    if (!adasMeeting.ok || !gracesMember.ok) throw new Error("setup failed");
    const [{ id: adaId }] = await app.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, "ada@example.com"));

    const insert = app.db.insert(meetingMember).values({
      organiserId: adaId,
      meetingId: adasMeeting.meeting.id,
      memberId: gracesMember.member.id,
    });

    await expect(insert).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining("FOREIGN KEY constraint failed"),
      }),
    });
    expect(await app.db.select().from(meetingMember)).toEqual([]);
  });

  it("refuses a Linked Group row that puts one Organiser's name on another's Meeting", async () => {
    const app = await createTestApp();
    const ada = await app.organiserData(
      await app.signUp({ name: "Ada", email: "ada@example.com" }),
    );
    const grace = await app.organiserData(
      await app.signUp({ name: "Grace", email: "grace@example.com" }),
    );
    const adasChoir = await ada.createGroup("Choir");
    const gracesMeeting = await grace.createMeeting({
      title: "Concert",
      date: "2099-07-01",
      time: "19:30",
    });
    if (!adasChoir.ok || !gracesMeeting.ok) throw new Error("setup failed");
    const [{ id: adaId }] = await app.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, "ada@example.com"));

    const insert = app.db.insert(meetingLinkedGroup).values({
      organiserId: adaId,
      meetingId: gracesMeeting.meeting.id,
      groupId: adasChoir.group.id,
    });

    await expect(insert).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining("FOREIGN KEY constraint failed"),
      }),
    });
    expect(await app.db.select().from(meetingLinkedGroup)).toEqual([]);
  });
});
