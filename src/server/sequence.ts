import { createServerFn } from "@tanstack/react-start";
import { bearerMiddleware } from "#/middleware/bearer.ts";
import { databaseMiddleware } from "#/middleware/database.ts";
import { protectedMiddleware } from "#/middleware/protected.ts";
import {
	getCurrentSequenceHandler,
	getSequenceHandler,
	padSequence,
	rollbackSequenceHandler,
} from "#/services/sequence.ts";

type SequenceResponse = {
	success: boolean;
	sequence: string | null; // 001, 012, 123, .etc
	message: string | null;
};

export const getSequence = createServerFn()
	.middleware([protectedMiddleware, databaseMiddleware])
	.handler(async ({ context }) => {
		try {
			const res = await getCurrentSequenceHandler({
				db: context.db,
				date: new Date(),
			});
			return {
				success: true,
				sequence: `V${res.sequenceDate}_${padSequence(res.sequence)}__`,
				message: null,
			} satisfies SequenceResponse;
		} catch (e) {
			const error = e as Error;
			return {
				success: false,
				sequence: null,
				message: error.message,
			} satisfies SequenceResponse;
		}
	});

// Get the latest sequence + 1
export const nextSequence = createServerFn()
	.middleware([bearerMiddleware, databaseMiddleware])
	.handler(async ({ context }) => {
		try {
			const res = await getSequenceHandler({
				db: context.db,
				date: new Date(),
			});

			return {
				success: true,
				sequence: `V${res.sequenceDate}_${padSequence(res.sequence)}__`,
				message: null,
			} satisfies SequenceResponse;
		} catch (e) {
			const error = e as Error;
			return {
				success: false,
				sequence: null,
				message: error.message,
			} satisfies SequenceResponse;
		}
	});

// Get the latest sequence and minus 1
export const rollbackSequence = createServerFn()
	.middleware([bearerMiddleware, databaseMiddleware])
	.handler(async ({ context }) => {
		try {
			const res = await rollbackSequenceHandler({
				db: context.db,
				date: new Date(),
			});
			return {
				success: true,
				sequence: `V${res.sequenceDate}_${padSequence(res.sequence)}__`,
				message: null,
			} satisfies SequenceResponse;
		} catch (e) {
			const error = e as Error;
			return {
				success: false,
				sequence: null,
				message: error.message,
			} satisfies SequenceResponse;
		}
	});
