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
    const cookie = headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    return new Headers({ cookie });
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
    canSignIn,
  };
}
