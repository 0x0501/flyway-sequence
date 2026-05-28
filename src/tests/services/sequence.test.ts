import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, test, vi } from "vitest";
import type { DBClient } from "../../db/client.ts";
import { sequences } from "../../db/schema/index.ts";
import {
	getCurrentFormattedTime,
	getDateKey,
	getSequenceHandler,
	padSequence,
	rollbackSequenceHandler,
} from "../../services/sequence.ts";

function createSequenceDb() {
	const sqlite = new Database(":memory:");

	sqlite.exec(`
		CREATE TABLE sequences (
			id integer primary key autoincrement,
			sequence_date integer not null unique,
			sequence integer default 1,
			locked_by text,
			created_at integer default (unixepoch()),
			updated_at integer default (unixepoch())
		)
	`);

	return {
		sqlite,
		db: drizzle(sqlite, {
			schema: {
				sequences,
			},
		}) as unknown as DBClient,
	};
}

describe("sequence service", () => {
	test("getCurrentFormattedTime formats dates in the Asia/Shanghai timezone", () => {
		expect(getCurrentFormattedTime(new Date("2026-05-28T01:02:03.000Z"))).toBe(
			"2026-05-28, 09:02:03",
		);
	});

	test("getDateKey uses the Asia/Shanghai day boundary", () => {
		expect(getDateKey(new Date("2026-05-27T16:30:00.000Z"))).toBe(20260528);
		expect(getDateKey(new Date("2026-05-28T15:59:59.000Z"))).toBe(20260528);
		expect(getDateKey(new Date("2026-05-28T16:00:00.000Z"))).toBe(20260529);
	});

	test("padSequence left-pads sequence numbers to three digits", () => {
		expect(padSequence(1)).toBe("001");
		expect(padSequence(12)).toBe("012");
		expect(padSequence(123)).toBe("123");
	});

	test("getSequenceHandler inserts and increments the sequence for each day", async () => {
		const { db, sqlite } = createSequenceDb();
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const sameDay = new Date("2026-05-28T01:02:03.000Z");
		const nextDay = new Date("2026-05-28T16:00:00.000Z");

		try {
			const first = await getSequenceHandler({ db, date: sameDay });
			const second = await getSequenceHandler({ db, date: sameDay });
			const third = await getSequenceHandler({ db, date: nextDay });

			expect(first.sequenceDate).toBe(20260528);
			expect(first.sequence).toBe(1);
			expect(second.sequenceDate).toBe(20260528);
			expect(second.sequence).toBe(2);
			expect(third.sequenceDate).toBe(20260529);
			expect(third.sequence).toBe(1);

			const [storedSameDay] = await db
				.select()
				.from(sequences)
				.where(eq(sequences.sequenceDate, 20260528));
			const [storedNextDay] = await db
				.select()
				.from(sequences)
				.where(eq(sequences.sequenceDate, 20260529));

			expect(storedSameDay?.sequence).toBe(2);
			expect(storedNextDay?.sequence).toBe(1);
			expect(info).toHaveBeenNthCalledWith(
				1,
				"Request 'getSequence' at 2026-05-28, 09:02:03.",
			);
			expect(info).toHaveBeenNthCalledWith(
				3,
				"Request 'getSequence' at 2026-05-29, 00:00:00.",
			);
		} finally {
			info.mockRestore();
			sqlite.close();
		}
	});

	test("getSequenceHandler throws when the insert flow returns no row", async () => {
		const returning = vi.fn(async () => []);
		const onConflictDoUpdate = vi.fn(() => ({ returning }));
		const values = vi.fn(() => ({ onConflictDoUpdate }));
		const insert = vi.fn(() => ({ values }));
		const db = { insert } as unknown as DBClient;

		await expect(
			getSequenceHandler({
				db,
				date: new Date("2026-05-28T01:02:03.000Z"),
			}),
		).rejects.toThrow("Failed to get sequence");
	});

	test("rollbackSequenceHandler decrements an existing sequence above one", async () => {
		const { db, sqlite } = createSequenceDb();
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const date = new Date("2026-05-28T01:02:03.000Z");

		try {
			await getSequenceHandler({ db, date });
			await getSequenceHandler({ db, date });

			const rolledBack = await rollbackSequenceHandler({ db, date });
			const [stored] = await db
				.select()
				.from(sequences)
				.where(eq(sequences.sequenceDate, 20260528));

			expect(rolledBack.sequence).toBe(1);
			expect(stored?.sequence).toBe(1);
			expect(info).toHaveBeenCalledWith(
				"Request 'rollbackSequence' at 2026-05-28, 09:02:03.",
			);
		} finally {
			info.mockRestore();
			sqlite.close();
		}
	});

	test("rollbackSequenceHandler rejects when the sequence is missing or already at one", async () => {
		const { db, sqlite } = createSequenceDb();
		const date = new Date("2026-05-28T01:02:03.000Z");

		try {
			await expect(rollbackSequenceHandler({ db, date })).rejects.toThrow(
				"Rollback sequence failed: sequence not found or already at minimum value (1)",
			);

			await getSequenceHandler({ db, date });

			await expect(rollbackSequenceHandler({ db, date })).rejects.toThrow(
				"Rollback sequence failed: sequence not found or already at minimum value (1)",
			);
		} finally {
			sqlite.close();
		}
	});
});
