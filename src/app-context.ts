import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { nextCookies } from "better-auth/next-js";
import { createAuth, DEFAULT_BASE_URL } from "@/auth/create-auth";
import { createDb, DEFAULT_DATABASE_URL } from "@/db/client";
import { createOrganiserData, SignedOutError } from "@/data/organiser-data";

const db = createDb(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL);

export const auth = createAuth({
  db,
  baseURL: process.env.BETTER_AUTH_URL ?? DEFAULT_BASE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  plugins: [nextCookies()],
});

const organiserData = createOrganiserData({ auth, db });

/**
 * The only way pages and server actions reach data: the Organiser-scoped
 * module for the current request's session. Signed-out visitors go to sign-in.
 */
export async function requireOrganiserData() {
  try {
    return await organiserData(await headers());
  } catch (error) {
    if (error instanceof SignedOutError) redirect("/sign-in");
    throw error;
  }
}
