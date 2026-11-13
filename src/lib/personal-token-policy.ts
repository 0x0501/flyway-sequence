import { z } from "zod";

export const PERSONAL_TOKEN_PREFIX = "fsq_";
export const personalTokenLifetimes = [30, 90, 180, 365] as const;
export const createPersonalTokenInput = z.object({
	name: z.string().trim().min(1).max(100),
	expiresInDays: z.union([
		z.literal(30),
		z.literal(90),
		z.literal(180),
		z.literal(365),
	]),
});
