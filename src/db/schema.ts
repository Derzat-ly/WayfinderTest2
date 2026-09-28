import { sql } from "drizzle-orm";
import {
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
