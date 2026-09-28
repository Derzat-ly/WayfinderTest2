import { afterEach, describe, expect, it, vi } from "vitest";
import { meeting } from "@/db/schema";
import { UnknownOrganiserError } from "@/operator/operator";
import { createTestApp } from "@/test/test-app";

describe("operator.catchUpAll()", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("finalises every Organiser's started Meetings, as ADR 0001 requires before changing data outside a request", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-01-01T09:00:00Z"));
    const app = await createTestApp();
    for (const email of ["ada@example.com", "grace@example.com"]) {
      const data = await app.organiserData(
        await app.signUp({ name: "Ada", email }),
      );
      await data.createMeeting({
        title: "Rehearsal",
        date: "2030-01-01",
        time: "10:00",
      });
    }

    const afterStart = new Date("2030-01-01T11:00:00Z");
    vi.setSystemTime(afterStart);
    await app.operator.catchUpAll();

    // Unobservable through an Organiser's data, since their request catches up too.
    const finalised = await app.db
      .select({ finalisedAt: meeting.finalisedAt })
      .from(meeting);
    expect(finalised).toEqual([
      { finalisedAt: afterStart },
      { finalisedAt: afterStart },
    ]);
  });
});

describe("operator.resetPassword(email)", () => {
  it("gives the Organiser a temporary password they can sign in with", async () => {
    const app = await createTestApp();
    await app.signUp({
      name: "Ada",
      email: "ada@example.com",
      password: "forgotten password",
    });

    const temporaryPassword = await app.operator.resetPassword("ada@example.com");

    expect(await app.canSignIn("ada@example.com", temporaryPassword)).toBe(true);
  });

  it("stops the old password from working", async () => {
    const app = await createTestApp();
    await app.signUp({
      name: "Ada",
      email: "ada@example.com",
      password: "forgotten password",
    });

    await app.operator.resetPassword("ada@example.com");

    expect(await app.canSignIn("ada@example.com", "forgotten password")).toBe(
      false,
    );
  });

  it("refuses an email no Organiser has and changes no one's password", async () => {
    const app = await createTestApp();
    await app.signUp({
      name: "Ada",
      email: "ada@example.com",
      password: "ada's password",
    });

    await expect(
      app.operator.resetPassword("nobody@example.com"),
    ).rejects.toThrow(UnknownOrganiserError);
    expect(await app.canSignIn("ada@example.com", "ada's password")).toBe(true);
  });
});
