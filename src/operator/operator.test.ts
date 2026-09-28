import { describe, expect, it } from "vitest";
import { UnknownOrganiserError } from "@/operator/operator";
import { createTestApp } from "@/test/test-app";

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
