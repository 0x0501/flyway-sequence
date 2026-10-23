import { sql } from "drizzle-orm";
import {
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
