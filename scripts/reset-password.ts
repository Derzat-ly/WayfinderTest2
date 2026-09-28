/**
 * Operator script: give an Organiser who forgot their password a temporary one.
 *
 *   npm run reset-password -- <email>
 *
 * Prints the generated password once. Pass it to the Organiser, who can sign
 * in with it and change it in Settings.
 */
import { config } from "dotenv";
import { createAuth, DEFAULT_BASE_URL } from "@/auth/create-auth";
import { createDb, DEFAULT_DATABASE_URL } from "@/db/client";
import { createOperator, UnknownOrganiserError } from "@/operator/operator";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run reset-password -- <email>");
    return 1;
  }

  const db = createDb(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
  const auth = createAuth({
    db,
    baseURL: process.env.BETTER_AUTH_URL ?? DEFAULT_BASE_URL,
  });
  const operator = createOperator({ auth, db });
  await operator.catchUpAll();

  try {
    const temporaryPassword = await operator.resetPassword(email);
    console.log(`Temporary password for ${email}: ${temporaryPassword}`);
    console.log("They can sign in with it and change it in Settings.");
    return 0;
  } catch (error) {
    if (error instanceof UnknownOrganiserError) {
      console.error(`${error.message}. Nothing was changed.`);
      return 1;
    }
    throw error;
  }
}

main().then((code) => process.exit(code));
