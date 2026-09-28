import { and, asc, count, eq } from "drizzle-orm";
import type { Auth } from "@/auth/create-auth";
import type { Db } from "@/db/client";
import { groupMembership, member, memberGroup, user } from "@/db/schema";
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

    async function ownsGroup(groupId: string) {
      const [row] = await db
        .select({ id: memberGroup.id })
        .from(memberGroup)
        .where(
          and(
            eq(memberGroup.organiserId, organiserId),
            eq(memberGroup.id, groupId),
          ),
        );
      return row !== undefined;
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
        const members = await db
          .select({ id: member.id, name: member.name, email: member.email })
          .from(member)
          .where(eq(member.organiserId, organiserId))
          .orderBy(asc(member.name));
        const memberships = await db
          .select({
            memberId: groupMembership.memberId,
            id: memberGroup.id,
            name: memberGroup.name,
          })
          .from(groupMembership)
          .innerJoin(memberGroup, eq(memberGroup.id, groupMembership.groupId))
          .where(eq(groupMembership.organiserId, organiserId))
          .orderBy(asc(memberGroup.name));
        return members.map((m) => ({
          ...m,
          groups: memberships
            .filter((g) => g.memberId === m.id)
            .map(({ id, name }) => ({ id, name })),
        }));
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
       * back until the Organiser repeats it with `confirmSameName`. With
       * `groupId`, the new Member also joins that Group.
       */
      async addMember(
        details: { name: string; email: string },
        {
          confirmSameName = false,
          groupId,
        }: { confirmSameName?: boolean; groupId?: string } = {},
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
        if (groupId && !(await ownsGroup(groupId))) {
          return { ok: false as const, notFound: true as const };
        }
        const added = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(member)
            .values({ organiserId, name, email, emailKey })
            .returning({ id: member.id });
          if (groupId) {
            await tx
              .insert(groupMembership)
              .values({ organiserId, groupId, memberId: row.id });
          }
          return row;
        });
        return { ok: true as const, member: added };
      },

      async groups() {
        return db
          .select({
            id: memberGroup.id,
            name: memberGroup.name,
            memberCount: count(groupMembership.memberId),
          })
          .from(memberGroup)
          .leftJoin(
            groupMembership,
            eq(groupMembership.groupId, memberGroup.id),
          )
          .where(eq(memberGroup.organiserId, organiserId))
          .groupBy(memberGroup.id)
          .orderBy(asc(memberGroup.name));
      },

      async group(id: string) {
        const [row] = await db
          .select({ id: memberGroup.id, name: memberGroup.name })
          .from(memberGroup)
          .where(
            and(eq(memberGroup.organiserId, organiserId), eq(memberGroup.id, id)),
          );
        if (!row) return undefined;
        const members = await db
          .select({ id: member.id, name: member.name, email: member.email })
          .from(groupMembership)
          .innerJoin(member, eq(member.id, groupMembership.memberId))
          .where(
            and(
              eq(groupMembership.organiserId, organiserId),
              eq(groupMembership.groupId, id),
            ),
          )
          .orderBy(asc(member.name));
        return { ...row, members };
      },

      async addToGroup(groupId: string, memberId: string) {
        const ownedGroup = await ownsGroup(groupId);
        const [ownedMember] = await db
          .select({ id: member.id })
          .from(member)
          .where(and(eq(member.organiserId, organiserId), eq(member.id, memberId)));
        if (!ownedGroup || !ownedMember) {
          return { ok: false as const, notFound: true as const };
        }
        await db
          .insert(groupMembership)
          .values({ organiserId, groupId, memberId })
          // Already in the Group (a double submit, a stale checkbox): done.
          .onConflictDoNothing({
            target: [groupMembership.groupId, groupMembership.memberId],
          });
        return { ok: true as const };
      },

      async createGroup(typedName: string) {
        const name = typedName.trim();
        if (!name) {
          return {
            ok: false as const,
            fieldErrors: { name: "Enter a name." },
          };
        }
        const [created] = await db
          .insert(memberGroup)
          .values({ organiserId, name })
          .returning({ id: memberGroup.id });
        return { ok: true as const, group: created };
      },

      /** Every Group, for the Member page's membership checkboxes. */
      async groupChoicesFor(memberId: string) {
        const rows = await db
          .select({
            id: memberGroup.id,
            name: memberGroup.name,
            memberId: groupMembership.memberId,
          })
          .from(memberGroup)
          .leftJoin(
            groupMembership,
            and(
              eq(groupMembership.groupId, memberGroup.id),
              eq(groupMembership.memberId, memberId),
            ),
          )
          .where(eq(memberGroup.organiserId, organiserId))
          .orderBy(asc(memberGroup.name));
        return rows.map(({ memberId, ...group }) => ({
          ...group,
          isMember: memberId !== null,
        }));
      },

      async removeFromGroup(groupId: string, memberId: string) {
        await db
          .delete(groupMembership)
          .where(
            and(
              eq(groupMembership.organiserId, organiserId),
              eq(groupMembership.groupId, groupId),
              eq(groupMembership.memberId, memberId),
            ),
          );
      },
    };
  };
}

export type OrganiserData = Awaited<
  ReturnType<ReturnType<typeof createOrganiserData>>
>;
