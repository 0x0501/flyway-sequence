import { and, eq, gt, sql } from "drizzle-orm";
import type { DBClient } from "#/db/client.ts";
import { sequences } from "../db/schema";

type SequenceServiceOptions = {
	db: DBClient;
	date: Date;
};

const sequenceDelta = 1;

export const formatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Asia/Shanghai",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hour12: false,
});

export const getCurrentFormattedTime = (date?: Date) =>
	formatter.format(date ?? new Date());

export const getDateKey = (date?: Date) => {
	const parts = formatter.formatToParts(date ?? new Date());

	const get = (type: Intl.DateTimeFormatPartTypes) => {
		const value = parts.find((part) => part.type === type)?.value;
		if (!value) {
			throw new Error(`Missing date part: ${type}`);
		}
		return value;
	};

	const year = get("year");
	const month = get("month");
	const day = get("day");

	return Number(`${year}${month}${day}`);
};

export function padSequence(num: number) {
	return String(num).padStart(3, "0");
}

export async function getCurrentSequenceHandler({
	db,
	date,
}: SequenceServiceOptions) {
	const sequenceDate = getDateKey(date);

	const [row] = await db
		.select()
		.from(sequences)
		.where(eq(sequences.sequenceDate, sequenceDate));

	if (!row) {
		throw new Error("Failed to get current sequence");
	}

	return row;
}

export async function getSequenceHandler({ db, date }: SequenceServiceOptions) {
	const sequenceDate = getDateKey(date);

	const [row] = await db
		.insert(sequences)
		.values({
			sequenceDate,
			sequence: 1,
			createdAt: sql`(unixepoch())`,
			updatedAt: sql`(unixepoch())`,
		})
		.onConflictDoUpdate({
			target: sequences.sequenceDate,
			set: {
				sequence: sql<number>`${sequences.sequence} + ${sequenceDelta}`,
				updatedAt: sql`(unixepoch())`,
			},
		})
		.returning({
			id: sequences.id,
			sequenceDate: sequences.sequenceDate,
			sequence: sequences.sequence,
			createdAt: sequences.createdAt,
			updatedAt: sequences.updatedAt,
		});

	if (!row) {
		throw new Error("Failed to get sequence");
	}

	console.info(`Request 'getSequence' at ${getCurrentFormattedTime(date)}.`);

	return row;
}

export async function rollbackSequenceHandler({
	db,
	date,
}: SequenceServiceOptions) {
	const sequenceDate = getDateKey(date);

	const [row] = await db
		.update(sequences)
		.set({
			sequence: sql<number>`${sequences.sequence} - 1`,
			updatedAt: sql`(unixepoch())`,
		})
		.where(
			and(eq(sequences.sequenceDate, sequenceDate), gt(sequences.sequence, 1)),
		)
		.returning({
			id: sequences.id,
			sequenceDate: sequences.sequenceDate,
			sequence: sequences.sequence,
			createdAt: sequences.createdAt,
			updatedAt: sequences.updatedAt,
		});

	if (!row) {
		throw new Error(
			"Rollback sequence failed: sequence not found or already at minimum value (1)",
		);
	}

	console.info(
		`Request 'rollbackSequence' at ${getCurrentFormattedTime(date)}.`,
	);

	return row;
}
