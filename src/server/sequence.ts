import { createServerFn } from "@tanstack/react-start";
import { databaseMiddleware } from "#/middleware/database.ts";
import { protectedMiddleware } from "#/middleware/protected.ts";
import { getCurrentSequenceHandler, padSequence } from "#/services/sequence.ts";

export type SequenceResponse = {
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
