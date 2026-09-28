import {
  and,
  asc,
  count,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  sql,
} from "drizzle-orm";
import type { Auth } from "@/auth/create-auth";
import type { Db } from "@/db/client";
import {
  attendee,
  groupMembership,
  meeting,
  meetingLinkedGroup,
  meetingMember,
  meetingSeries,
  member,
  memberGroup,
  seriesLinkedGroup,
  seriesMember,
  user,
} from "@/db/schema";
import {
  describeRepeat,
  occurrenceStart,
  SERIES_HORIZON_MS,
} from "@/meeting-series";
import { isIanaTimezone, zonedToInstant } from "@/timezone";

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

export type Attendee = {
  /** NULL on a started Meeting's record once the Member is deleted. */
  memberId: string | null;
  name: string;
  email: string;
} & (
  | { addedVia: "individual" }
  | {
      addedVia: "copy" | "linked";
      /** `id` is NULL on a started Meeting's record once the Group is deleted. */
      group: { id: string | null; name: string };
    }
);

/** An Attendee of a Meeting that hasn't started, so always a current Member. */
export type LiveAttendee = Attendee & { memberId: string };

export type MeetingFieldErrors = Partial<
  Record<"title" | "start" | "durationMinutes" | "repeatEvery", string>
>;

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
    return organiserDataFor(db, session.user.id);
  };
}

/**
 * The data module for one Organiser, after catching up their Meetings.
 * Only for a request's session (above) and the Operator, who acts for everyone.
 */
export async function organiserDataFor(db: Db, organiserId: string) {

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
    return ownsGroups([groupId]);
  }

  async function ownsGroups(groupIds: string[]) {
    if (groupIds.length === 0) return true;
    const unique = [...new Set(groupIds)];
    const [{ owned }] = await db
      .select({ owned: count() })
      .from(memberGroup)
      .where(
        and(
          eq(memberGroup.organiserId, organiserId),
          inArray(memberGroup.id, unique),
        ),
      );
    return owned === unique.length;
  }

  async function ownsMeeting(meetingId: string) {
    const [row] = await db
      .select({ id: meeting.id })
      .from(meeting)
      .where(
        and(eq(meeting.organiserId, organiserId), eq(meeting.id, meetingId)),
      );
    return row !== undefined;
  }

  async function ownsMembers(memberIds: string[]) {
    if (memberIds.length === 0) return true;
    const unique = [...new Set(memberIds)];
    const [{ owned }] = await db
      .select({ owned: count() })
      .from(member)
      .where(
        and(eq(member.organiserId, organiserId), inArray(member.id, unique)),
      );
    return owned === unique.length;
  }

  /**
   * Who each live Meeting's Attendees are: its individual choices plus the
   * current Members of its Linked Groups, one row per Member, by name.
   */
  async function attendeesOf(meetingIds: string[]) {
    const individual = await db
      .select({
        meetingId: meetingMember.meetingId,
        memberId: member.id,
        name: member.name,
        email: member.email,
        copiedFrom: { id: memberGroup.id, name: memberGroup.name },
      })
      .from(meetingMember)
      .innerJoin(member, eq(member.id, meetingMember.memberId))
      .leftJoin(
        memberGroup,
        eq(memberGroup.id, meetingMember.copiedFromGroupId),
      )
      .where(
        and(
          eq(meetingMember.organiserId, organiserId),
          inArray(meetingMember.meetingId, meetingIds),
        ),
      );
    const linked = await db
      .select({
        meetingId: meetingLinkedGroup.meetingId,
        memberId: member.id,
        name: member.name,
        email: member.email,
        groupId: memberGroup.id,
        groupName: memberGroup.name,
      })
      .from(meetingLinkedGroup)
      .innerJoin(memberGroup, eq(memberGroup.id, meetingLinkedGroup.groupId))
      .innerJoin(
        groupMembership,
        eq(groupMembership.groupId, meetingLinkedGroup.groupId),
      )
      .innerJoin(member, eq(member.id, groupMembership.memberId))
      .where(
        and(
          eq(meetingLinkedGroup.organiserId, organiserId),
          inArray(meetingLinkedGroup.meetingId, meetingIds),
        ),
      )
      .orderBy(asc(memberGroup.name));
    const byMeeting = new Map(
      meetingIds.map((id) => [id, new Map<string, LiveAttendee>()]),
    );
    for (const { meetingId, copiedFrom, ...a } of individual) {
      byMeeting
        .get(meetingId)!
        .set(
          a.memberId,
          copiedFrom
            ? { ...a, addedVia: "copy", group: copiedFrom }
            : { ...a, addedVia: "individual" },
        );
    }
    for (const { meetingId, groupId, groupName, ...a } of linked) {
      const attendees = byMeeting.get(meetingId)!;
      if (attendees.has(a.memberId)) continue;
      attendees.set(a.memberId, {
        ...a,
        addedVia: "linked",
        group: { id: groupId, name: groupName },
      });
    }
    return new Map(
      [...byMeeting].map(([id, attendees]) => [
        id,
        [...attendees.values()].sort((a, b) => a.name.localeCompare(b.name)),
      ]),
    );
  }

  /**
   * Writes a started Meeting's fixed record: its Attendees as they are
   * now, frozen Group names on its links, and `finalised_at`.
   */
  async function finalise(meetingId: string) {
    const attendees = (await attendeesOf([meetingId])).get(meetingId)!;
    const phones = new Map(
      (
        await db
          .select({ id: member.id, phone: member.phone })
          .from(member)
          .where(inArray(member.id, attendees.map((a) => a.memberId)))
      ).map((m) => [m.id, m.phone]),
    );
    const links = await db
      .select({
        id: meetingLinkedGroup.id,
        groupId: meetingLinkedGroup.groupId,
        groupName: memberGroup.name,
      })
      .from(meetingLinkedGroup)
      .innerJoin(memberGroup, eq(memberGroup.id, meetingLinkedGroup.groupId))
      .where(
        and(
          eq(meetingLinkedGroup.organiserId, organiserId),
          eq(meetingLinkedGroup.meetingId, meetingId),
        ),
      );
    await db.transaction(async (tx) => {
      if (attendees.length > 0) {
        await tx.insert(attendee).values(
          attendees.map((a) => ({
            organiserId,
            meetingId,
            memberId: a.memberId,
            name: a.name,
            email: a.email,
            phone: phones.get(a.memberId) ?? null,
            addedVia: a.addedVia,
            viaLinkId:
              a.addedVia === "linked"
                ? links.find((l) => l.groupId === a.group.id)!.id
                : null,
          })),
        );
      }
      for (const link of links) {
        await tx
          .update(meetingLinkedGroup)
          .set({ groupName: link.groupName })
          .where(eq(meetingLinkedGroup.id, link.id));
      }
      await tx
        .update(meeting)
        .set({ finalisedAt: new Date() })
        .where(eq(meeting.id, meetingId));
    });
  }

  /**
   * Creates a Series' next Meetings while they start within the horizon,
   * or while it has no future Meeting yet, each a copy of the Series.
   */
  async function topUp(seriesId: string) {
    const [series] = await db
      .select()
      .from(meetingSeries)
      .where(
        and(
          eq(meetingSeries.organiserId, organiserId),
          eq(meetingSeries.id, seriesId),
        ),
      );
    const now = Date.now();
    const [future] = await db
      .select({ id: meeting.id })
      .from(meeting)
      .where(and(eq(meeting.seriesId, seriesId), gt(meeting.startAt, new Date(now))))
      .limit(1);
    let hasFuture = future !== undefined;
    const memberIds = (
      await db
        .select({ id: seriesMember.memberId })
        .from(seriesMember)
        .where(eq(seriesMember.seriesId, seriesId))
    ).map((m) => m.id);
    const groupIds = (
      await db
        .select({ id: seriesLinkedGroup.groupId })
        .from(seriesLinkedGroup)
        .where(eq(seriesLinkedGroup.seriesId, seriesId))
    ).map((g) => g.id);
    for (let n = series.nextOccurrenceIndex; ; n++) {
      const startAt = occurrenceStart(series, n);
      if (hasFuture && startAt.getTime() > now + SERIES_HORIZON_MS) break;
      hasFuture ||= startAt.getTime() > now;
      await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(meeting)
          .values({
            organiserId,
            seriesId,
            occurrenceIndex: n,
            title: series.title,
            startAt,
            timezone: series.timezone,
            durationMinutes: series.durationMinutes,
            location: series.location,
            notes: series.notes,
            privateNotes: series.privateNotes,
          })
          .returning({ id: meeting.id });
        if (memberIds.length > 0) {
          await tx.insert(meetingMember).values(
            memberIds.map((memberId) => ({
              organiserId,
              meetingId: row.id,
              memberId,
            })),
          );
        }
        if (groupIds.length > 0) {
          await tx.insert(meetingLinkedGroup).values(
            groupIds.map((groupId) => ({
              organiserId,
              meetingId: row.id,
              groupId,
            })),
          );
        }
        await tx
          .update(meetingSeries)
          .set({ nextOccurrenceIndex: n + 1 })
          .where(eq(meetingSeries.id, seriesId));
      });
    }
  }

  /**
   * The lazy catch-up (ADR 0001), run before this request touches
   * anything: top up every Series' Meetings, then finalise every Meeting
   * whose start has passed.
   */
  async function catchUp() {
    const running = await db
      .select({ id: meetingSeries.id })
      .from(meetingSeries)
      .where(
        and(
          eq(meetingSeries.organiserId, organiserId),
          isNull(meetingSeries.endedAt),
        ),
      );
    for (const { id } of running) await topUp(id);
    const due = await db
      .select({ id: meeting.id })
      .from(meeting)
      .where(
        and(
          eq(meeting.organiserId, organiserId),
          isNull(meeting.finalisedAt),
          lte(meeting.startAt, new Date()),
        ),
      );
    for (const { id } of due) await finalise(id);
  }

  /** A finalised Meeting's Linked Groups, named as they were at its start. */
  async function frozenLinksOf(meetingId: string) {
    const rows = await db
      .select({
        id: meetingLinkedGroup.groupId,
        name: meetingLinkedGroup.groupName,
      })
      .from(meetingLinkedGroup)
      .where(
        and(
          eq(meetingLinkedGroup.organiserId, organiserId),
          eq(meetingLinkedGroup.meetingId, meetingId),
        ),
      );
    // The name is set at finalisation; `id` is NULL once the Group is deleted.
    return rows.map(({ id, name }) => ({ id, name: name! }));
  }

  /** A finalised Meeting's Attendees from its fixed record, by name. */
  async function snapshotOf(meetingId: string): Promise<Attendee[]> {
    const rows = await db
      .select({
        memberId: attendee.memberId,
        name: attendee.name,
        email: attendee.email,
        addedVia: attendee.addedVia,
        // Led by the link's own id: Drizzle nulls a joined object whose first
        // field is NULL, and `group_id` is once the Group is deleted.
        link: {
          id: meetingLinkedGroup.id,
          groupId: meetingLinkedGroup.groupId,
          groupName: meetingLinkedGroup.groupName,
        },
        copiedFrom: { id: memberGroup.id, name: memberGroup.name },
      })
      .from(attendee)
      .leftJoin(
        meetingLinkedGroup,
        eq(meetingLinkedGroup.id, attendee.viaLinkId),
      )
      .leftJoin(
        meetingMember,
        and(
          eq(meetingMember.meetingId, attendee.meetingId),
          eq(meetingMember.memberId, attendee.memberId),
        ),
      )
      .leftJoin(
        memberGroup,
        eq(memberGroup.id, meetingMember.copiedFromGroupId),
      )
      .where(
        and(
          eq(attendee.organiserId, organiserId),
          eq(attendee.meetingId, meetingId),
        ),
      )
      .orderBy(asc(attendee.name));
    return rows.map(({ addedVia, link, copiedFrom, ...a }) => {
      if (addedVia === "linked" && link) {
        return {
          ...a,
          addedVia,
          group: { id: link.groupId, name: link.groupName! },
        };
      }
      if (addedVia === "copy" && copiedFrom) {
        return { ...a, addedVia, group: copiedFrom };
      }
      return { ...a, addedVia: "individual" };
    });
  }

  /**
   * Each Meeting's and each Series' Attendee choices as a comparable key, so
   * a Meeting whose choices differ from its Series' can be marked changed.
   * A copy of a Group is its own kind of choice, which a Series never has.
   */
  async function choicesOf(meetingIds: string[], seriesIds: string[]) {
    const keys = new Map<string, string[]>();
    const add = (id: string, key: string) =>
      keys.set(id, [...(keys.get(id) ?? []), key]);
    for (const m of await db
      .select({
        id: meetingMember.meetingId,
        memberId: meetingMember.memberId,
        copiedFrom: meetingMember.copiedFromGroupId,
      })
      .from(meetingMember)
      .where(
        and(
          eq(meetingMember.organiserId, organiserId),
          inArray(meetingMember.meetingId, meetingIds),
        ),
      )) {
      add(m.id, `${m.copiedFrom ? "copy" : "member"}:${m.memberId}`);
    }
    for (const g of await db
      .select({ id: meetingLinkedGroup.meetingId, groupId: meetingLinkedGroup.groupId })
      .from(meetingLinkedGroup)
      .where(
        and(
          eq(meetingLinkedGroup.organiserId, organiserId),
          inArray(meetingLinkedGroup.meetingId, meetingIds),
        ),
      )) {
      // A frozen link's Group id is NULL once the Group is deleted, as the
      // Series' own link then is.
      if (g.groupId) add(g.id, `group:${g.groupId}`);
    }
    for (const m of await db
      .select({ id: seriesMember.seriesId, memberId: seriesMember.memberId })
      .from(seriesMember)
      .where(
        and(
          eq(seriesMember.organiserId, organiserId),
          inArray(seriesMember.seriesId, seriesIds),
        ),
      )) {
      add(m.id, `member:${m.memberId}`);
    }
    for (const g of await db
      .select({ id: seriesLinkedGroup.seriesId, groupId: seriesLinkedGroup.groupId })
      .from(seriesLinkedGroup)
      .where(
        and(
          eq(seriesLinkedGroup.organiserId, organiserId),
          inArray(seriesLinkedGroup.seriesId, seriesIds),
        ),
      )) {
      add(g.id, `group:${g.groupId}`);
    }
    return new Map(
      [...keys].map(([id, choices]) => [id, choices.sort().join(" ")]),
    );
  }

  /** Upcoming Meetings with a live link to a Group, soonest first. */
  async function upcomingLinks() {
    return db
      .select({
        groupId: meetingLinkedGroup.groupId,
        id: meeting.id,
        title: meeting.title,
        startAt: meeting.startAt,
        timezone: meeting.timezone,
      })
      .from(meetingLinkedGroup)
      .innerJoin(meeting, eq(meeting.id, meetingLinkedGroup.meetingId))
      .where(
        and(
          eq(meetingLinkedGroup.organiserId, organiserId),
          gt(meeting.startAt, new Date()),
        ),
      )
      .orderBy(asc(meeting.startAt));
  }

  await catchUp();

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
      if (!row) return undefined;
      const groups = await db
        .select({ id: memberGroup.id, name: memberGroup.name })
        .from(groupMembership)
        .innerJoin(memberGroup, eq(memberGroup.id, groupMembership.groupId))
        .where(
          and(
            eq(groupMembership.organiserId, organiserId),
            eq(groupMembership.memberId, id),
          ),
        )
        .orderBy(asc(memberGroup.name));
      const upcoming = await db
        .select({
          id: meeting.id,
          title: meeting.title,
          startAt: meeting.startAt,
          timezone: meeting.timezone,
        })
        .from(meeting)
        .where(
          and(
            eq(meeting.organiserId, organiserId),
            gt(meeting.startAt, new Date()),
          ),
        )
        .orderBy(asc(meeting.startAt));
      const attendees = await attendeesOf(upcoming.map((m) => m.id));
      return {
        ...row,
        groups,
        upcomingMeetings: upcoming.filter((m) =>
          attendees.get(m.id)!.some((a) => a.memberId === id),
        ),
      };
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
     * A hard delete. The schema's cascades take the Member out of every
     * Group and upcoming Meeting; a started Meeting's record keeps their
     * snapshot with its Member id nulled.
     */
    async deleteMember(id: string) {
      const deleted = await db
        .delete(member)
        .where(and(eq(member.organiserId, organiserId), eq(member.id, id)))
        .returning({ id: member.id });
      if (deleted.length === 0) {
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
      const groups = await db
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
      const links = await upcomingLinks();
      return groups.map((g) => ({
        ...g,
        upcomingMeetingCount: links.filter((l) => l.groupId === g.id).length,
      }));
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
      const upcomingMeetings = (await upcomingLinks())
        .filter((l) => l.groupId === id)
        .map(({ id, title, startAt, timezone }) => ({
          id,
          title,
          startAt,
          timezone,
        }));
      return { ...row, members, upcomingMeetings };
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

    /**
     * Counts as every Member leaving the Group. Links on Meetings not yet
     * started go; started Meetings keep theirs frozen, with the Group's name
     * and a NULL Group id. Copies of it stay, their mark cleared.
     */
    async deleteGroup(id: string) {
      if (!(await ownsGroup(id))) {
        return { ok: false as const, notFound: true as const };
      }
      await db.transaction(async (tx) => {
        const unstarted = tx
          .select({ id: meeting.id })
          .from(meeting)
          .where(
            and(eq(meeting.organiserId, organiserId), isNull(meeting.finalisedAt)),
          );
        await tx
          .delete(meetingLinkedGroup)
          .where(
            and(
              eq(meetingLinkedGroup.organiserId, organiserId),
              eq(meetingLinkedGroup.groupId, id),
              inArray(meetingLinkedGroup.meetingId, unstarted),
            ),
          );
        await tx
          .delete(memberGroup)
          .where(
            and(eq(memberGroup.organiserId, organiserId), eq(memberGroup.id, id)),
          );
      });
      return { ok: true as const };
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

    /**
     * `date` and `time` are read in the Organiser's current timezone, and
     * the Meeting keeps a copy of that zone (ADR 0002).
     */
    async createMeeting(
      details: {
        title: string;
        date: string;
        time: string;
        durationMinutes?: string;
        location?: string;
        notes?: string;
        privateNotes?: string;
        /** "day" or "week" to set up a Meeting Series; empty for a one-off. */
        repeatUnit?: string;
        repeatEvery?: string;
      },
      {
        memberIds = [],
        groupIds = [],
      }: { memberIds?: string[]; groupIds?: string[] } = {},
    ) {
      const title = details.title.trim();
      const fieldErrors: MeetingFieldErrors = {};
      if (!title) fieldErrors.title = "Enter a title.";
      if (!details.date || !details.time) {
        fieldErrors.start = "Enter a date and start time.";
      }
      const duration = details.durationMinutes?.trim();
      if (duration && !/^[1-9]\d*$/.test(duration)) {
        fieldErrors.durationMinutes = "Enter the duration in whole minutes.";
      }
      const repeats =
        details.repeatUnit === "day" || details.repeatUnit === "week";
      const repeatEvery = details.repeatEvery?.trim() ?? "";
      if (repeats && !/^[1-9]\d*$/.test(repeatEvery)) {
        fieldErrors.repeatEvery =
          "Enter how many days or weeks apart, as a whole number.";
      }
      if (Object.keys(fieldErrors).length > 0) {
        return { ok: false as const, fieldErrors };
      }
      if (!(await ownsMembers(memberIds)) || !(await ownsGroups(groupIds))) {
        return { ok: false as const, notFound: true as const };
      }
      const [{ timezone }] = await db
        .select({ timezone: user.timezone })
        .from(user)
        .where(eq(user.id, organiserId));
      const shared = {
        organiserId,
        title,
        timezone,
        durationMinutes: duration ? Number(duration) : null,
        location: details.location?.trim() || null,
        notes: details.notes?.trim() || null,
        privateNotes: details.privateNotes?.trim() || null,
      };
      const startAt = zonedToInstant(details.date, details.time, timezone);
      if (repeats) {
        const series = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(meetingSeries)
            .values({
              ...shared,
              anchorStartAt: startAt,
              intervalUnit: details.repeatUnit as "day" | "week",
              intervalCount: Number(repeatEvery),
            })
            .returning({ id: meetingSeries.id });
          if (memberIds.length > 0) {
            await tx
              .insert(seriesMember)
              .values(
                memberIds.map((memberId) => ({
                  organiserId,
                  seriesId: row.id,
                  memberId,
                })),
              )
              .onConflictDoNothing({
                target: [seriesMember.seriesId, seriesMember.memberId],
              });
          }
          if (groupIds.length > 0) {
            await tx
              .insert(seriesLinkedGroup)
              .values(
                groupIds.map((groupId) => ({
                  organiserId,
                  seriesId: row.id,
                  groupId,
                })),
              )
              .onConflictDoNothing({
                target: [seriesLinkedGroup.seriesId, seriesLinkedGroup.groupId],
              });
          }
          return row;
        });
        await topUp(series.id);
        const [first] = await db
          .select({ id: meeting.id })
          .from(meeting)
          .where(
            and(eq(meeting.seriesId, series.id), eq(meeting.occurrenceIndex, 0)),
          );
        return { ok: true as const, meeting: first };
      }
      const created = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(meeting)
          .values({ ...shared, startAt })
          .returning({ id: meeting.id });
        if (memberIds.length > 0) {
          await tx
            .insert(meetingMember)
            .values(
            memberIds.map((memberId) => ({
              organiserId,
              meetingId: row.id,
              memberId,
            })),
          )
          .onConflictDoNothing({
            target: [meetingMember.meetingId, meetingMember.memberId],
          });
        }
        if (groupIds.length > 0) {
          await tx
            .insert(meetingLinkedGroup)
            .values(
              groupIds.map((groupId) => ({
                organiserId,
                meetingId: row.id,
                groupId,
              })),
            )
            .onConflictDoNothing({
              target: [meetingLinkedGroup.meetingId, meetingLinkedGroup.groupId],
            });
        }
        return row;
      });
      return { ok: true as const, meeting: created };
    },

    /** Upcoming soonest first, Past most recent first, split by start time. */
    async meetings() {
      const rows = await db
        .select({
          id: meeting.id,
          title: meeting.title,
          startAt: meeting.startAt,
          timezone: meeting.timezone,
          location: meeting.location,
          finalisedAt: meeting.finalisedAt,
          seriesId: meeting.seriesId,
        })
        .from(meeting)
        .where(eq(meeting.organiserId, organiserId))
        .orderBy(asc(meeting.startAt));
      const ids = rows.map((m) => m.id);
      const live = await attendeesOf(
        rows.filter((m) => !m.finalisedAt).map((m) => m.id),
      );
      const recorded = new Map(
        (
          await db
            .select({ meetingId: attendee.meetingId, count: count() })
            .from(attendee)
            .where(
              and(
                eq(attendee.organiserId, organiserId),
                inArray(attendee.meetingId, ids),
              ),
            )
            .groupBy(attendee.meetingId)
        ).map((r) => [r.meetingId, r.count]),
      );
      // Frozen links carry the Group's name from the start; live ones don't.
      const linkName = sql<string>`coalesce(${meetingLinkedGroup.groupName}, ${memberGroup.name})`;
      const links = await db
        .select({ meetingId: meetingLinkedGroup.meetingId, name: linkName })
        .from(meetingLinkedGroup)
        .leftJoin(memberGroup, eq(memberGroup.id, meetingLinkedGroup.groupId))
        .where(
          and(
            eq(meetingLinkedGroup.organiserId, organiserId),
            inArray(meetingLinkedGroup.meetingId, ids),
          ),
        )
        .orderBy(asc(linkName));
      const choices = await choicesOf(
        rows.filter((m) => m.seriesId !== null).map((m) => m.id),
        [...new Set(rows.map((m) => m.seriesId).filter((id) => id !== null))],
      );
      const listed = rows.map(({ finalisedAt, seriesId, ...m }) => ({
        ...m,
        inSeries: seriesId !== null,
        changed:
          seriesId !== null &&
          (choices.get(m.id) ?? "") !== (choices.get(seriesId) ?? ""),
        attendeeCount: finalisedAt
          ? (recorded.get(m.id) ?? 0)
          : live.get(m.id)!.length,
        linkedGroupNames: links
          .filter((l) => l.meetingId === m.id)
          .map((l) => l.name),
      }));
      const now = Date.now();
      return {
        upcoming: listed.filter((m) => m.startAt.getTime() > now),
        past: listed.filter((m) => m.startAt.getTime() <= now).reverse(),
      };
    },

    async meeting(id: string) {
      const [row] = await db
        .select({
          id: meeting.id,
          title: meeting.title,
          startAt: meeting.startAt,
          timezone: meeting.timezone,
          durationMinutes: meeting.durationMinutes,
          location: meeting.location,
          notes: meeting.notes,
          privateNotes: meeting.privateNotes,
          finalisedAt: meeting.finalisedAt,
          series: {
            anchorStartAt: meetingSeries.anchorStartAt,
            timezone: meetingSeries.timezone,
            intervalUnit: meetingSeries.intervalUnit,
            intervalCount: meetingSeries.intervalCount,
          },
        })
        .from(meeting)
        .leftJoin(meetingSeries, eq(meetingSeries.id, meeting.seriesId))
        .where(and(eq(meeting.organiserId, organiserId), eq(meeting.id, id)));
      if (!row) return undefined;
      const { finalisedAt, series, ...rest } = row;
      const details = {
        ...rest,
        series: series && { repeats: describeRepeat(series) },
      };
      const linkedGroups = finalisedAt
        ? await frozenLinksOf(id)
        : await db
            .select({ id: memberGroup.id, name: memberGroup.name })
            .from(meetingLinkedGroup)
            .innerJoin(
              memberGroup,
              eq(memberGroup.id, meetingLinkedGroup.groupId),
            )
            .where(
              and(
                eq(meetingLinkedGroup.organiserId, organiserId),
                eq(meetingLinkedGroup.meetingId, id),
              ),
            );
      const copiedGroups = await db
        .selectDistinct({ id: memberGroup.id, name: memberGroup.name })
        .from(meetingMember)
        .innerJoin(
          memberGroup,
          eq(memberGroup.id, meetingMember.copiedFromGroupId),
        )
        .where(
          and(
            eq(meetingMember.organiserId, organiserId),
            eq(meetingMember.meetingId, id),
          ),
        );
      const shown = {
        ...details,
        linkedGroups: [
          ...linkedGroups.map((g) => ({ ...g, kind: "live" as const })),
          ...copiedGroups.map((g) => ({ ...g, kind: "copy" as const })),
        ].sort((a, b) => a.name.localeCompare(b.name)),
      };
      if (finalisedAt) {
        return {
          ...shown,
          started: true as const,
          attendees: await snapshotOf(id),
        };
      }
      return {
        ...shown,
        started: false as const,
        attendees: (await attendeesOf([id])).get(id)!,
      };
    },

    async linkGroup(meetingId: string, groupId: string) {
      if (!(await ownsMeeting(meetingId)) || !(await ownsGroup(groupId))) {
        return { ok: false as const, notFound: true as const };
      }
      await db
        .insert(meetingLinkedGroup)
        .values({ organiserId, meetingId, groupId })
        // Already linked (a double submit): done.
        .onConflictDoNothing({
          target: [meetingLinkedGroup.meetingId, meetingLinkedGroup.groupId],
        });
      return { ok: true as const };
    },

    async unlinkGroup(meetingId: string, groupId: string) {
      await db
        .delete(meetingLinkedGroup)
        .where(
          and(
            eq(meetingLinkedGroup.organiserId, organiserId),
            eq(meetingLinkedGroup.meetingId, meetingId),
            eq(meetingLinkedGroup.groupId, groupId),
          ),
        );
    },

    async addAttendee(meetingId: string, memberId: string) {
      if (!(await ownsMeeting(meetingId)) || !(await ownsMembers([memberId]))) {
        return { ok: false as const, notFound: true as const };
      }
      await db
        .insert(meetingMember)
        .values({ organiserId, meetingId, memberId })
        // Already an Attendee (a double submit, a stale picker): done.
        .onConflictDoNothing({
          target: [meetingMember.meetingId, meetingMember.memberId],
        });
      return { ok: true as const };
    },

    /**
     * A Member who came through a Linked Group is only removed once the
     * Organiser repeats it with `confirmCopy`.
     */
    async removeAttendee(
      meetingId: string,
      memberId: string,
      { confirmCopy = false }: { confirmCopy?: boolean } = {},
    ) {
      if (!(await ownsMeeting(meetingId))) {
        return { ok: false as const, notFound: true as const };
      }
      const coveringGroups = await db
        .select({ id: memberGroup.id, name: memberGroup.name })
        .from(meetingLinkedGroup)
        .innerJoin(memberGroup, eq(memberGroup.id, meetingLinkedGroup.groupId))
        .innerJoin(
          groupMembership,
          and(
            eq(groupMembership.groupId, meetingLinkedGroup.groupId),
            eq(groupMembership.memberId, memberId),
          ),
        )
        .where(
          and(
            eq(meetingLinkedGroup.organiserId, organiserId),
            eq(meetingLinkedGroup.meetingId, meetingId),
          ),
        )
        .orderBy(asc(memberGroup.name));
      if (coveringGroups.length > 0 && !confirmCopy) {
        return {
          ok: false as const,
          confirmCopy: { groups: coveringGroups },
        };
      }
      await db.transaction(async (tx) => {
        // Each covering link becomes a copy of the rest of its Group.
        for (const group of coveringGroups) {
          await tx
            .delete(meetingLinkedGroup)
            .where(
              and(
                eq(meetingLinkedGroup.organiserId, organiserId),
                eq(meetingLinkedGroup.meetingId, meetingId),
                eq(meetingLinkedGroup.groupId, group.id),
              ),
            );
          const rest = await tx
            .select({ memberId: groupMembership.memberId })
            .from(groupMembership)
            .where(
              and(
                eq(groupMembership.organiserId, organiserId),
                eq(groupMembership.groupId, group.id),
              ),
            );
          const copies = rest.filter((m) => m.memberId !== memberId);
          if (copies.length > 0) {
            await tx
              .insert(meetingMember)
              .values(
                copies.map((m) => ({
                  organiserId,
                  meetingId,
                  memberId: m.memberId,
                  copiedFromGroupId: group.id,
                })),
              )
              // Already chosen individually or copied: keep that.
              .onConflictDoNothing({
                target: [meetingMember.meetingId, meetingMember.memberId],
              });
          }
        }
        await tx
          .delete(meetingMember)
          .where(
            and(
              eq(meetingMember.organiserId, organiserId),
              eq(meetingMember.meetingId, meetingId),
              eq(meetingMember.memberId, memberId),
            ),
          );
      });
      return { ok: true as const };
    },
  };
}

export type OrganiserData = Awaited<
  ReturnType<ReturnType<typeof createOrganiserData>>
>;
