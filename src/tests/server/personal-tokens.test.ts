import { readdirSync, readFileSync } from "node:fs";
import {
	Client,
	StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, expect, test, vi } from "vitest";
import type { DBClient } from "../../db/client.ts";
import * as schema from "../../db/schema/index.ts";
import { createAuthOptions } from "../../lib/auth.ts";
import { checkGithubOrgMember } from "../../server/github.ts";
import { createSequenceMcpServer } from "../../server/mcp.ts";
import { authenticateMcpRequest } from "../../server/mcp-auth.ts";
import { createMcpRequestHandler } from "../../server/mcp-handler.ts";
import { verifyOrgAccess } from "../../server/org-access.ts";
import {
	createPersonalToken,
	findPersonalToken,
	listPersonalTokens,
	recordPersonalTokenUse,
	revokePersonalToken,
} from "../../services/personal-token.ts";

const endpoint = "http://localhost:3910/api/mcp";

vi.mock("../../env.ts", () => ({
	env: {
		BETTER_AUTH_URL: "http://localhost:3910",
		MCP_RESOURCE_URL: "http://localhost:3910/api/mcp",
		GITHUB_ORGANIZATION: "test-org",
		GITHUB_CLIENT_ID: "test-client",
		GITHUB_CLIENT_SECRET: "test-secret",
	},
}));
vi.mock("../../server/github.ts", () => ({
	checkGithubOrgMember: vi.fn(async () => true),
}));

const databases: Database.Database[] = [];

afterEach(() => {
	for (const sqlite of databases.splice(0)) sqlite.close();
	vi.restoreAllMocks();
	vi.mocked(checkGithubOrgMember).mockReset().mockResolvedValue(true);
});

function setup() {
	const sqlite = new Database(":memory:");
	databases.push(sqlite);
	sqlite.pragma("foreign_keys = ON");
	const directory = new URL("../../../drizzle/", import.meta.url);
	for (const name of readdirSync(directory)
		.filter((name) => name.endsWith(".sql"))
		.sort())
		sqlite.exec(readFileSync(new URL(name, directory), "utf8"));
	const database = drizzle(sqlite, { schema });
	const db = database as unknown as DBClient;
	const auth = betterAuth({
		...createAuthOptions(),
		emailAndPassword: { enabled: true },
		secret: "test-only-personal-token-secret-at-least-32-characters",
		database: drizzleAdapter(database, { provider: "sqlite" }),
	});
	for (const userId of ["member", "other-member"]) {
		sqlite
			.prepare("INSERT INTO user (id, name, email) VALUES (?, ?, ?)")
			.run(userId, userId, `${userId}@example.com`);
		sqlite
			.prepare(
				"INSERT INTO account (id, account_id, provider_id, user_id, access_token, updated_at) VALUES (?, ?, 'github', ?, ?, ?)",
			)
			.run(
				`${userId}-local-account`,
				`${userId}-external-subject`,
				userId,
				`${userId}-github-token`,
				Date.now(),
			);
	}
	return { sqlite, db, auth };
}

function request(token?: string, scheme = "Bearer") {
	return new Request(endpoint, {
		method: "POST",
		headers: token ? { authorization: `${scheme} ${token}` } : {},
	});
}

test("personal token metadata and revocation are isolated by owner and secrets are hashed", async () => {
	const { db, sqlite } = setup();
	const first = await createPersonalToken(db, "member", {
		name: " Work laptop ",
		expiresInDays: 90,
	});
	const second = await createPersonalToken(db, "other-member", {
		name: "Other laptop",
		expiresInDays: 30,
	});
	expect(first.token).toMatch(/^fsq_[0-9a-f]{64}$/);
	expect(first.token).not.toBe(second.token);
	expect(first.metadata).toMatchObject({
		name: "Work laptop",
		tokenPrefix: first.token.slice(0, 12),
		lastUsedAt: null,
		revokedAt: null,
	});
	expect(
		first.metadata.expiresAt.getTime() - first.metadata.createdAt.getTime(),
	).toBe(90 * 86_400_000);
	const stored = sqlite.prepare("SELECT * FROM personal_token").all() as {
		token_hash: string;
	}[];
	expect(stored[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
	expect(JSON.stringify(stored)).not.toContain(first.token);
	const listing = await listPersonalTokens(db, "member");
	expect(listing).toEqual([first.metadata]);
	expect(JSON.stringify(listing)).not.toContain(stored[0].token_hash);
	expect(JSON.stringify(listing)).not.toContain(first.token);
	await revokePersonalToken(db, "other-member", first.metadata.id);
	expect(await findPersonalToken(db, first.token)).not.toBeNull();
	await revokePersonalToken(db, "member", first.metadata.id);
	expect(await findPersonalToken(db, first.token)).toBeNull();
	expect(await recordPersonalTokenUse(db, first.metadata.id)).toBe(false);
	expect((await listPersonalTokens(db, "member"))[0].revokedAt).toBeInstanceOf(
		Date,
	);
	expect(await findPersonalToken(db, second.token)).not.toBeNull();
	sqlite.prepare("DELETE FROM user WHERE id = 'other-member'").run();
	expect(await findPersonalToken(db, second.token)).toBeNull();
});

test("personal tokens require valid input and stop working at expiration", async () => {
	const { db, sqlite, auth } = setup();
	await expect(
		createPersonalToken(db, "member", { name: "   ", expiresInDays: 30 }),
	).rejects.toThrow();
	await expect(
		createPersonalToken(db, "member", {
			name: "a".repeat(101),
			expiresInDays: 30,
		}),
	).rejects.toThrow();
	const created = await createPersonalToken(db, "member", {
		name: "Expiring",
		expiresInDays: 30,
	});
	sqlite.prepare("UPDATE personal_token SET expires_at = 0").run();
	for (const token of [
		created.token,
		"fsq_short",
		`fsq_${"0".repeat(64)}`,
		`${created.token}extra`,
		undefined,
	]) {
		const result = await authenticateMcpRequest(request(token), auth, db);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.status).toBe(401);
			expect(result.response.headers.get("www-authenticate")).toContain(
				"resource_metadata",
			);
		}
	}
	expect(await recordPersonalTokenUse(db, created.metadata.id)).toBe(false);
	expect(checkGithubOrgMember).not.toHaveBeenCalled();
});

test("Bearer tokens check their owner's organization without a browser session or JWKS", async () => {
	const { db, sqlite, auth } = setup();
	const { token, metadata } = await createPersonalToken(db, "member", {
		name: "CLI",
		expiresInDays: 180,
	});
	const jwks = vi.spyOn(auth.api, "getJwks");
	const result = await authenticateMcpRequest(request(token), auth, db);
	expect(result).toMatchObject({
		ok: true,
		authInfo: {
			clientId: `personal-token:${metadata.id}`,
			scopes: ["mcp:write"],
			extra: { userId: "member" },
		},
	});
	expect(checkGithubOrgMember).toHaveBeenCalledWith(
		"member-github-token",
		"test-org",
	);
	expect(jwks).not.toHaveBeenCalled();
	expect((await listPersonalTokens(db, "member"))[0].lastUsedAt).toBeInstanceOf(
		Date,
	);
	expect((await authenticateMcpRequest(request(token), auth, db)).ok).toBe(
		true,
	);
	expect(checkGithubOrgMember).toHaveBeenCalledTimes(1);
	expect(
		await verifyOrgAccess(auth, db, new Headers(), "test-org"),
	).toMatchObject({ ok: false, status: 401 });
	const dpop = await authenticateMcpRequest(request(token, "DPoP"), auth, db);
	expect(dpop.ok).toBe(false);
	if (!dpop.ok) expect(dpop.response.status).toBe(401);
	sqlite.prepare("UPDATE github_org_membership SET expires_at = 0").run();
	vi.mocked(checkGithubOrgMember).mockResolvedValue(false);
	const denied = await authenticateMcpRequest(request(token), auth, db);
	expect(denied.ok).toBe(false);
	if (!denied.ok) expect(denied.response.status).toBe(403);
	expect(
		sqlite.prepare("SELECT expires_at FROM github_org_membership").get(),
	).toEqual({ expires_at: 0 });
});

test("unlinked accounts and invalid GitHub credentials fail closed; database failures propagate", async () => {
	const { db, sqlite, auth } = setup();
	const { token } = await createPersonalToken(db, "member", {
		name: "CLI",
		expiresInDays: 30,
	});
	vi.spyOn(auth.api, "getAccessToken").mockRejectedValueOnce(
		new APIError("BAD_REQUEST", {
			message: "Failed to get a valid access token",
		}),
	);
	const failedToken = await authenticateMcpRequest(request(token), auth, db);
	expect(failedToken.ok).toBe(false);
	if (!failedToken.ok) expect(failedToken.response.status).toBe(403);
	sqlite.prepare("DELETE FROM account WHERE user_id = 'member'").run();
	const unlinked = await authenticateMcpRequest(request(token), auth, db);
	expect(unlinked.ok).toBe(false);
	if (!unlinked.ok) expect(unlinked.response.status).toBe(403);
	expect(checkGithubOrgMember).not.toHaveBeenCalled();
	const failure = new Error("D1 unavailable");
	vi.spyOn(db, "select").mockImplementationOnce(() => {
		throw failure;
	});
	await expect(authenticateMcpRequest(request(token), auth, db)).rejects.toBe(
		failure,
	);
});

test("revocation during an organization check blocks the pending request", async () => {
	const { db, auth } = setup();
	const { token, metadata } = await createPersonalToken(db, "member", {
		name: "Revoked while checking",
		expiresInDays: 30,
	});
	let markStarted: (() => void) | undefined;
	let completeMembership: ((allowed: boolean) => void) | undefined;
	const started = new Promise<void>((resolve) => {
		markStarted = resolve;
	});
	const membership = new Promise<boolean>((resolve) => {
		completeMembership = resolve;
	});
	vi.mocked(checkGithubOrgMember).mockImplementationOnce(() => {
		markStarted?.();
		return membership;
	});
	const pending = authenticateMcpRequest(request(token), auth, db);
	await started;
	await revokePersonalToken(db, "member", metadata.id);
	completeMembership?.(true);
	const result = await pending;
	expect(result.ok).toBe(false);
	if (!result.ok) expect(result.response.status).toBe(401);
	expect((await listPersonalTokens(db, "member"))[0].lastUsedAt).toBeNull();
});

test("official MCP client calls tools using a personal Bearer token and is rejected after revocation", async () => {
	const { db, auth } = setup();
	const { token, metadata } = await createPersonalToken(db, "member", {
		name: "SDK",
		expiresInDays: 365,
	});
	const allocate = vi.fn(async () => ({
		success: true,
		sequence: "V20261113_001__",
		message: null,
	}));
	const handler = createMcpRequestHandler(
		() =>
			createSequenceMcpServer({
				allocateNextSequence: allocate,
				rollbackLatestSequence: allocate,
			}),
		endpoint,
	);
	const client = new Client(
		{ name: "bearer-integration", version: "1.0.0" },
		{ versionNegotiation: { mode: { pin: "2026-07-28" } } },
	);
	const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
		requestInit: { headers: { authorization: `Bearer ${token}` } },
		fetch: async (url, init) => {
			const incoming = new Request(url, init);
			incoming.headers.set("host", new URL(incoming.url).host);
			const access = await authenticateMcpRequest(incoming, auth, db);
			return access.ok
				? handler(incoming, { authInfo: access.authInfo })
				: access.response;
		},
	});
	try {
		await client.connect(transport);
		expect((await client.listTools()).tools).toHaveLength(2);
		const result = await client.callTool({ name: "next_sequence" });
		expect(result.isError).not.toBe(true);
		expect(allocate).toHaveBeenCalledTimes(1);
		await revokePersonalToken(db, "member", metadata.id);
		await expect(client.callTool({ name: "next_sequence" })).rejects.toThrow();
		expect(allocate).toHaveBeenCalledTimes(1);
	} finally {
		await client.close();
	}
});
