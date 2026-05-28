import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sequences = sqliteTable("sequences", {
	id: integer({ mode: "number" }).primaryKey({
		autoIncrement: true,
	}),
	sequenceDate: integer("sequence_date", { mode: "timestamp" })
		.notNull()
		.unique(),
	sequence: integer("sequence", { mode: "number" }).default(1).notNull(),
	lockedBy: text("locked_by", { mode: "text" }),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
});
