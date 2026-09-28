import { and, asc, eq } from "drizzle-orm";
import type { Auth } from "@/auth/create-auth";
import type { Db } from "@/db/client";
import { member, user } from "@/db/schema";
import { isIanaTimezone } from "@/timezone";

export class SignedOutError extends Error {
  constructor() {
    super("No Organiser is signed in");
    this.name = "SignedOutError";
  }
}

export class InvalidTimezoneError extends Error {
  constructor(timezone: string) {
    super(`${JSON.stringify(timezone)} is not an IANA timezone`);
    this.name = "InvalidTimezoneError";
  }
}

export type MemberFieldErrors = Partial<Record<"name" | "email", string>>;

function checkMemberFields(details: { name: string; email: string }) {
  const name = details.name.trim();
  const email = details.email.trim();
  const fieldErrors: MemberFieldErrors = {};
  if (!name) fieldErrors.name = "Enter a name.";
  if (!email) fieldErrors.email = "Enter an email.";
  return { name, email, emailKey: email.toLowerCase(), fieldErrors };
}

/**
 * The isolation boundary. SQLite has no row-level security, so every read
 * and write an Organiser makes goes through the functions returned here,
 * which are bound to the Organiser id taken from the request's session.
 * Pages never query the database directly.
 */
export function createOrganiserData({ auth, db }: { auth: Auth; db: Db }) {
  return async function organiserData(headers: Headers) {
    const session = await auth.api.getSession({ headers });
    if (!session) throw new SignedOutError();
    const organiserId = session.user.id;

    async function memberWithEmailKey(emailKey: string) {
      const [row] = await db
        .select({ id: member.id, name: member.name })
        .from(member)
        .where(
          and(eq(member.organiserId, organiserId), eq(member.emailKey, emailKey)),
        );
      return row;
    }

    return {
      async organiser() {
        const [row] = await db
          .select({
            name: user.name,
            email: user.email,
            timezone: user.timezone,
          })
          .from(user)
          .where(eq(user.id, organiserId));
        return row;
      },

      async setTimezone(timezone: string) {
        if (!isIanaTimezone(timezone)) throw new InvalidTimezoneError(timezone);
        await db.update(user).set({ timezone }).where(eq(user.id, organiserId));
      },

      async members() {
        return db
          .select({ id: member.id, name: member.name, email: member.email })
          .from(member)
          .where(eq(member.organiserId, organiserId))
          .orderBy(asc(member.name));
      },

      async member(id: string) {
        const [row] = await db
          .select({
            id: member.id,
            name: member.name,
            email: member.email,
            phone: member.phone,
            notes: member.notes,
          })
          .from(member)
          .where(and(eq(member.organiserId, organiserId), eq(member.id, id)));
        return row;
      },

      async updateMember(
        id: string,
        details: { name: string; email: string; phone: string; notes: string },
      ) {
        const { name, email, emailKey, fieldErrors } =
          checkMemberFields(details);
        if (Object.keys(fieldErrors).length > 0) {
          return { ok: false as const, fieldErrors };
        }
        const duplicateEmail = await memberWithEmailKey(emailKey);
        if (duplicateEmail && duplicateEmail.id !== id) {
          return { ok: false as const, duplicateEmail };
        }
        const updated = await db
          .update(member)
          .set({
            name,
            email,
            emailKey,
            phone: details.phone.trim() || null,
            notes: details.notes.trim() || null,
          })
          .where(and(eq(member.organiserId, organiserId), eq(member.id, id)))
          .returning({ id: member.id });
        if (updated.length === 0) {
          return { ok: false as const, notFound: true as const };
        }
        return { ok: true as const };
      },

      /**
       * A name another Member already has is only a warning: the add is held
       * back until the Organiser repeats it with `confirmSameName`.
       */
      async addMember(
        details: { name: string; email: string },
        { confirmSameName = false } = {},
      ) {
        const { name, email, emailKey, fieldErrors } =
          checkMemberFields(details);
        if (Object.keys(fieldErrors).length > 0) {
          return { ok: false as const, fieldErrors };
        }
        const duplicateEmail = await memberWithEmailKey(emailKey);
        if (duplicateEmail) return { ok: false as const, duplicateEmail };
        if (!confirmSameName) {
          const [sameName] = await db
            .select({ id: member.id })
            .from(member)
            .where(
              and(eq(member.organiserId, organiserId), eq(member.name, name)),
            )
            .limit(1);
          if (sameName) return { ok: false as const, sameName: true as const };
        }
        const [added] = await db
          .insert(member)
          .values({ organiserId, name, email, emailKey })
          .returning({ id: member.id });
        return { ok: true as const, member: added };
      },
    };
  };
}

export type OrganiserData = Awaited<
  ReturnType<ReturnType<typeof createOrganiserData>>
>;
