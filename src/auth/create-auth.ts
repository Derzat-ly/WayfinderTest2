import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { isIanaTimezone } from "@/timezone";

export const DEFAULT_BASE_URL = "http://localhost:3000";

type Options = {
  db: Db;
  baseURL?: string;
  secret?: string;
  plugins?: BetterAuthPlugin[];
};

/** Email and password only: no OAuth, magic link, verification or reset email. */
export function createAuth({ db, baseURL, secret, plugins = [] }: Options) {
  return betterAuth({
    baseURL,
    secret,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        timezone: { type: "string", required: true, input: true },
      },
    },
    databaseHooks: {
      user: {
        create: {
          async before(organiser) {
            const { timezone } = organiser as { timezone?: string };
            if (!timezone || !isIanaTimezone(timezone)) {
              throw new APIError("BAD_REQUEST", {
                message: "Timezone must be an IANA zone",
              });
            }
          },
        },
      },
    },
    plugins,
  });
}

export type Auth = ReturnType<typeof createAuth>;
