import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { z } from "zod";
import type { DBClient } from "#/db/client.ts";
import { personalToken } from "#/db/schema/index.ts";
import {
	createPersonalTokenInput,
	PERSONAL_TOKEN_PREFIX,
} from "#/lib/personal-token-policy.ts";

const tokenMetadata = {
	id: personalToken.id,
	name: personalToken.name,
	tokenPrefix: personalToken.tokenPrefix,
	createdAt: personalToken.createdAt,
	expiresAt: personalToken.expiresAt,
	lastUsedAt: personalToken.lastUsedAt,
	revokedAt: personalToken.revokedAt,
};

function toHex(bytes: Uint8Array) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

async function hashToken(token: string) {
	return toHex(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
		),
	);
}

export async function createPersonalToken(
	db: DBClient,
	userId: string,
	input: z.input<typeof createPersonalTokenInput>,
) {
	const { name, expiresInDays } = createPersonalTokenInput.parse(input);
	const token = `${PERSONAL_TOKEN_PREFIX}${toHex(crypto.getRandomValues(new Uint8Array(32)))}`;
	const createdAt = new Date();
	const [metadata] = await db
		.insert(personalToken)
		.values({
			id: crypto.randomUUID(),
			userId,
			name,
			tokenHash: await hashToken(token),
			tokenPrefix: token.slice(0, 12),
			createdAt,
			expiresAt: new Date(createdAt.getTime() + expiresInDays * 86_400_000),
		})
		.returning(tokenMetadata);
	return { token, metadata };
}

export async function listPersonalTokens(db: DBClient, userId: string) {
	return db
		.select(tokenMetadata)
		.from(personalToken)
		.where(eq(personalToken.userId, userId))
		.orderBy(desc(personalToken.createdAt));
}

export async function revokePersonalToken(
	db: DBClient,
	userId: string,
	tokenId: string,
) {
	await db
		.update(personalToken)
		.set({ revokedAt: new Date() })
		.where(
			and(
				eq(personalToken.id, tokenId),
				eq(personalToken.userId, userId),
				isNull(personalToken.revokedAt),
			),
		);
}

export async function findPersonalToken(db: DBClient, token: string) {
	if (!/^fsq_[0-9a-f]{64}$/.test(token)) return null;
	const [record] = await db
		.select({
			id: personalToken.id,
			userId: personalToken.userId,
			expiresAt: personalToken.expiresAt,
		})
		.from(personalToken)
		.where(
			and(
				eq(personalToken.tokenHash, await hashToken(token)),
				isNull(personalToken.revokedAt),
				gt(personalToken.expiresAt, new Date()),
			),
		);
	return record ?? null;
}

export async function recordPersonalTokenUse(db: DBClient, tokenId: string) {
	const now = new Date();
	const [record] = await db
		.update(personalToken)
		.set({ lastUsedAt: now })
		.where(
			and(
				eq(personalToken.id, tokenId),
				isNull(personalToken.revokedAt),
				gt(personalToken.expiresAt, now),
			),
		)
		.returning({ id: personalToken.id });
	return Boolean(record);
}
