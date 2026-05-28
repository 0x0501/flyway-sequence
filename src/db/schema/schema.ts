import { sql } from "drizzle-orm";
import { integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const sequences = sqliteTable("sequences", {
	id: integer({ mode: "number" }).primaryKey({
		autoIncrement: true,
	}),
	sequenceDate: integer("sequence_date", { mode: "number" })
		.notNull()
		.unique(),
	sequence: integer("sequence", { mode: "number" }).default(1).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
});
