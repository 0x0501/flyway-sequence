import { sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth.ts";

export const sequences = sqliteTable("sequences", {
	id: integer({ mode: "number" }).primaryKey({
		autoIncrement: true,
	}),
	sequenceDate: integer("sequence_date", { mode: "number" }).notNull().unique(),
	sequence: integer("sequence", { mode: "number" }).default(1).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
});

export const githubOrgMembership = sqliteTable(
	"github_org_membership",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		organization: text("organization").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [primaryKey({ columns: [table.userId, table.organization] })],
);

export const personalToken = sqliteTable(
	"personal_token",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		tokenHash: text("token_hash").notNull().unique(),
		tokenPrefix: text("token_prefix").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
		revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
	},
	(table) => [index("personal_token_user_id_idx").on(table.userId)],
);
