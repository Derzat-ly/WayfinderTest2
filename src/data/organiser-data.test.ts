import { describe, expect, it } from "vitest";
import { InvalidTimezoneError, SignedOutError } from "@/data/organiser-data";
import { createTestApp } from "@/test/test-app";

describe("organiserData(headers)", () => {
  it("belongs to the Organiser whose session made the request", async () => {
    const app = await createTestApp();
    await app.signUp({
      name: "Ada",
      email: "ada@example.com",
      timezone: "Europe/London",
    });
    const graceSession = await app.signUp({
      name: "Grace",
      email: "grace@example.com",
      timezone: "America/New_York",
    });

    const data = await app.organiserData(graceSession);

    expect(await data.organiser()).toEqual({
      name: "Grace",
      email: "grace@example.com",
      timezone: "America/New_York",
    });
  });

  it("changes the signed-in Organiser's timezone and no one else's", async () => {
    const app = await createTestApp();
    const adaSession = await app.signUp({
      name: "Ada",
      email: "ada@example.com",
      timezone: "Europe/London",
    });
    const graceSession = await app.signUp({
      name: "Grace",
      email: "grace@example.com",
      timezone: "America/New_York",
    });

    await (await app.organiserData(adaSession)).setTimezone("Asia/Tokyo");

    const ada = await (await app.organiserData(adaSession)).organiser();
    const grace = await (await app.organiserData(graceSession)).organiser();
    expect(ada.timezone).toBe("Asia/Tokyo");
    expect(grace.timezone).toBe("America/New_York");
  });

  it.each(["Mars/Olympus", "+01:00", ""])(
    "refuses %j as a timezone and keeps the old one",
    async (notAZone) => {
      const app = await createTestApp();
      const session = await app.signUp({
        name: "Ada",
        email: "ada@example.com",
        timezone: "Europe/London",
      });
      const data = await app.organiserData(session);

      await expect(data.setTimezone(notAZone)).rejects.toThrow(
        InvalidTimezoneError,
      );
      expect((await data.organiser()).timezone).toBe("Europe/London");
    },
  );

  it("refuses a request with no signed-in Organiser", async () => {
    const app = await createTestApp();

    await expect(app.organiserData(new Headers())).rejects.toThrow(
      SignedOutError,
    );
  });
});
