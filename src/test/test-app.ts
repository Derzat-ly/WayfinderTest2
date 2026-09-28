import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createAuth } from "@/auth/create-auth";
import { createDb } from "@/db/client";
import { createOrganiserData } from "@/data/organiser-data";
import { createOperator } from "@/operator/operator";

/**
 * A fresh app wired to its own migrated SQLite file, for testing the
 * Organiser-scoped data module the way pages reach it: through a session.
 */
export async function createTestApp() {
  const dir = mkdtempSync(join(tmpdir(), "group-meetings-test-"));
  const db = createDb(pathToFileURL(join(dir, "test.db")).href);
  await migrate(db, { migrationsFolder: "drizzle" });
  const auth = createAuth({
    db,
    secret: "test-secret-that-is-at-least-32-characters",
  });

  /** Signs an Organiser up and returns request headers carrying their session. */
  async function signUp(organiser: {
    name: string;
    email: string;
    timezone?: string;
    password?: string;
  }) {
    const { headers } = await auth.api.signUpEmail({
      body: {
        password: "correct horse battery staple",
        timezone: "UTC",
        ...organiser,
      },
      returnHeaders: true,
    });
    return sessionHeaders(headers);
  }

  /** Signs an existing Organiser in, e.g. once their session has expired. */
  async function signIn(
    email: string,
    password = "correct horse battery staple",
  ) {
    const { headers } = await auth.api.signInEmail({
      body: { email, password },
      returnHeaders: true,
    });
    return sessionHeaders(headers);
  }

  /** Whether Better Auth accepts this email and password. */
  async function canSignIn(email: string, password: string) {
    try {
      await auth.api.signInEmail({ body: { email, password } });
      return true;
    } catch {
      return false;
    }
  }

  return {
    /** Raw access, only for testing what the schema itself enforces. */
    db,
    organiserData: createOrganiserData({ auth, db }),
    operator: createOperator({ auth, db }),
    signUp,
    signIn,
    canSignIn,
  };
}

/** Request headers carrying the session cookie Better Auth just set. */
function sessionHeaders(headers: Headers) {
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}
