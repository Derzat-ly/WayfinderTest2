import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date()),
};

// Better Auth's tables. An Organiser is a `user` row.

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  /** IANA zone every new Meeting copies (ADR 0002). */
  timezone: text("timezone").notNull(),
  ...timestamps,
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  ...timestamps,
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp_ms",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp_ms",
  }),
  scope: text("scope"),
  password: text("password"),
  ...timestamps,
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  ...timestamps,
});

// Everything an Organiser owns carries `organiser_id`, and each owned parent
// has UNIQUE (organiser_id, id) so children can use composite foreign keys.

export const member = sqliteTable(
  "member",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organiserId: text("organiser_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** As typed. */
    email: text("email").notNull(),
    /**
     * Trimmed and lower-cased by the data module, for case-insensitive
     * uniqueness. COLLATE NOCASE would only fold ASCII.
     */
    emailKey: text("email_key").notNull(),
    phone: text("phone"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    unique().on(t.organiserId, t.id),
    unique().on(t.organiserId, t.emailKey),
    index("member_organiser_id_name_idx").on(t.organiserId, t.name),
  ],
);

/** A Group. Named this way because `group` is an SQL keyword. */
export const memberGroup = sqliteTable(
  "member_group",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organiserId: text("organiser_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Not unique. */
    name: text("name").notNull(),
    ...timestamps,
  },
  (t) => [unique().on(t.organiserId, t.id)],
);

/**
 * Which Members are in which Groups. The composite foreign keys make the
 * database refuse a link between one Organiser's Group and another's Member.
 */
export const groupMembership = sqliteTable(
  "group_membership",
  {
    organiserId: text("organiser_id").notNull(),
    groupId: text("group_id").notNull(),
    memberId: text("member_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.memberId] }),
    foreignKey({
      columns: [t.organiserId, t.groupId],
      foreignColumns: [memberGroup.organiserId, memberGroup.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.organiserId, t.memberId],
      foreignColumns: [member.organiserId, member.id],
    }).onDelete("cascade"),
    index("group_membership_member_id_idx").on(t.memberId),
  ],
);

/**
 * A Meeting Series: the details and Attendee choices each of its Meetings
 * starts as a copy of. Occurrence n is worked out from the anchor, in the
 * Series' own copy of the Organiser's timezone (ADR 0002).
 */
export const meetingSeries = sqliteTable(
  "meeting_series",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organiserId: text("organiser_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    durationMinutes: integer("duration_minutes"),
    location: text("location"),
    notes: text("notes"),
    privateNotes: text("private_notes"),
    /** The first occurrence's start. */
    anchorStartAt: integer("anchor_start_at", { mode: "timestamp_ms" }).notNull(),
    timezone: text("timezone").notNull(),
    intervalUnit: text("interval_unit", { enum: ["day", "week"] }).notNull(),
    intervalCount: integer("interval_count").notNull(),
    /** The catch-up cursor: the occurrence the Series produces next (ADR 0001). */
    nextOccurrenceIndex: integer("next_occurrence_index").notNull().default(0),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [
    unique().on(t.organiserId, t.id),
    check("meeting_series_interval_count_check", sql`${t.intervalCount} >= 1`),
  ],
);

/** A Group linked to a Meeting Series, copied to each Meeting it produces. */
export const seriesLinkedGroup = sqliteTable(
  "series_linked_group",
  {
    organiserId: text("organiser_id").notNull(),
    seriesId: text("series_id").notNull(),
    groupId: text("group_id").notNull(),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.seriesId, t.groupId] }),
    foreignKey({
      columns: [t.organiserId, t.seriesId],
      foreignColumns: [meetingSeries.organiserId, meetingSeries.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.organiserId, t.groupId],
      foreignColumns: [memberGroup.organiserId, memberGroup.id],
    }).onDelete("cascade"),
    index("series_linked_group_group_id_idx").on(t.groupId),
  ],
);

/** A Member chosen individually for a Meeting Series. */
export const seriesMember = sqliteTable(
  "series_member",
  {
    organiserId: text("organiser_id").notNull(),
    seriesId: text("series_id").notNull(),
    memberId: text("member_id").notNull(),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.seriesId, t.memberId] }),
    foreignKey({
      columns: [t.organiserId, t.seriesId],
      foreignColumns: [meetingSeries.organiserId, meetingSeries.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.organiserId, t.memberId],
      foreignColumns: [member.organiserId, member.id],
    }).onDelete("cascade"),
    index("series_member_member_id_idx").on(t.memberId),
  ],
);

/**
 * A Meeting. The start is a UTC instant plus the Organiser's timezone copied
 * when the row was created, which is how it is shown from then on (ADR 0002).
 */
export const meeting = sqliteTable(
  "meeting",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organiserId: text("organiser_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Set for one occurrence of a Meeting Series. */
    seriesId: text("series_id"),
    occurrenceIndex: integer("occurrence_index"),
    title: text("title").notNull(),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    timezone: text("timezone").notNull(),
    durationMinutes: integer("duration_minutes"),
    location: text("location"),
    notes: text("notes"),
    privateNotes: text("private_notes"),
    /** Set by the catch-up step once the start has passed (ADR 0001). */
    finalisedAt: integer("finalised_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [
    unique().on(t.organiserId, t.id),
    unique().on(t.seriesId, t.occurrenceIndex),
    // What ending or deleting a Series does to its Meetings isn't decided yet.
    foreignKey({
      columns: [t.organiserId, t.seriesId],
      foreignColumns: [meetingSeries.organiserId, meetingSeries.id],
    }),
    index("meeting_organiser_id_start_at_idx").on(t.organiserId, t.startAt),
    index("meeting_organiser_id_finalised_at_start_at_idx").on(
      t.organiserId,
      t.finalisedAt,
      t.startAt,
    ),
  ],
);

/**
 * A Group added whole to a Meeting. Live until the Meeting starts, then the
 * frozen record, which is when `group_name` is filled.
 */
export const meetingLinkedGroup = sqliteTable(
  "meeting_linked_group",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organiserId: text("organiser_id").notNull(),
    meetingId: text("meeting_id").notNull(),
    /** Single-column so a Group delete nulls only this. */
    groupId: text("group_id").references(() => memberGroup.id, {
      onDelete: "set null",
    }),
    groupName: text("group_name"),
    ...timestamps,
  },
  (t) => [
    unique().on(t.meetingId, t.groupId),
    foreignKey({
      columns: [t.organiserId, t.meetingId],
      foreignColumns: [meeting.organiserId, meeting.id],
    }).onDelete("cascade"),
    index("meeting_linked_group_group_id_idx").on(t.groupId),
  ],
);

/**
 * Members chosen individually for a Meeting, whether added one by one or
 * copied from a Linked Group. The composite foreign keys make the database
 * refuse one Organiser's Meeting with another's Member.
 */
export const meetingMember = sqliteTable(
  "meeting_member",
  {
    organiserId: text("organiser_id").notNull(),
    meetingId: text("meeting_id").notNull(),
    memberId: text("member_id").notNull(),
    /** Single-column so a Group delete nulls only this. */
    copiedFromGroupId: text("copied_from_group_id").references(
      () => memberGroup.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.meetingId, t.memberId] }),
    foreignKey({
      columns: [t.organiserId, t.meetingId],
      foreignColumns: [meeting.organiserId, meeting.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.organiserId, t.memberId],
      foreignColumns: [member.organiserId, member.id],
    }).onDelete("cascade"),
    index("meeting_member_member_id_idx").on(t.memberId),
  ],
);

/**
 * A started Meeting's Attendees: the fixed record the catch-up step writes
 * when it finalises the Meeting (ADR 0001), untouched by later edits.
 */
export const attendee = sqliteTable(
  "attendee",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organiserId: text("organiser_id").notNull(),
    meetingId: text("meeting_id").notNull(),
    /** Single-column so a Member delete nulls only this: NULL is a deleted Member. */
    memberId: text("member_id").references(() => member.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    /** How the Member was added; the first of individual, copy, linked that applies. */
    addedVia: text("added_via", {
      enum: ["individual", "copy", "linked"],
    }).notNull(),
    viaLinkId: text("via_link_id").references(() => meetingLinkedGroup.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    unique().on(t.meetingId, t.memberId),
    foreignKey({
      columns: [t.organiserId, t.meetingId],
      foreignColumns: [meeting.organiserId, meeting.id],
    }).onDelete("cascade"),
    index("attendee_member_id_idx").on(t.memberId),
  ],
);
