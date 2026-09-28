import { generateRandomString } from "better-auth/crypto";
import type { Auth } from "@/auth/create-auth";
import type { Db } from "@/db/client";
import { user } from "@/db/schema";
import { organiserDataFor } from "@/data/organiser-data";

export class UnknownOrganiserError extends Error {
  constructor(email: string) {
    super(`No Organiser has the email ${email}`);
    this.name = "UnknownOrganiserError";
  }
}

/** What the Operator does to the app by hand, outside any Organiser's request. */
export function createOperator({ auth, db }: { auth: Auth; db: Db }) {
  return {
    /**
     * Runs the lazy catch-up for every Organiser. Anything that changes data
     * outside a request must call this first, or it can corrupt the fixed
     * record of Meetings that started while the app was off (ADR 0001).
     */
    async catchUpAll() {
      for (const { id } of await db.select({ id: user.id }).from(user)) {
        await organiserDataFor(db, id);
      }
    },


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
