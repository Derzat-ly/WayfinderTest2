import { generateRandomString } from "better-auth/crypto";
import type { Auth } from "@/auth/create-auth";

export class UnknownOrganiserError extends Error {
  constructor(email: string) {
    super(`No Organiser has the email ${email}`);
    this.name = "UnknownOrganiserError";
  }
}

/** What the Operator does to the app by hand, outside any Organiser's request. */
export function createOperator({ auth }: { auth: Auth }) {
  return {
    /** Sets and returns a temporary password for the Organiser with this email. */
    async resetPassword(email: string): Promise<string> {
      const ctx = await auth.$context;
      const found = await ctx.internalAdapter.findUserByEmail(email);
      if (!found) throw new UnknownOrganiserError(email);
      const temporaryPassword = generateRandomString(16);
      await ctx.internalAdapter.updatePassword(
        found.user.id,
        await ctx.password.hash(temporaryPassword),
      );
      return temporaryPassword;
    },
  };
}
