import { readdirSync, readFileSync } from "node:fs";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { deriveDpopAth, deriveDpopJkt } from "better-auth/oauth2";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { expect, test, vi } from "vitest";
import { z } from "zod";
import type { DBClient } from "../../db/client.ts";
import * as schema from "../../db/schema/index.ts";
import { createAuthOptions } from "../../lib/auth.ts";
import { AUTH_CACHE_SECONDS, tokenLifetimes } from "../../lib/auth-policy.ts";
import { handleAuthRequest } from "../../server/auth-request.ts";
import { checkGithubOrgMember } from "../../server/github.ts";
import { authenticateMcpRequest } from "../../server/mcp-auth.ts";
import { verifyOrgAccess } from "../../server/org-access.ts";

vi.mock("../../env.ts", () => ({
	env: {
		BETTER_AUTH_URL: "http://localhost:3907",
		MCP_RESOURCE_URL: "http://localhost:3907/api/mcp",
		GITHUB_ORGANIZATION: "test-org",
		GITHUB_CLIENT_ID: "test-client",
		GITHUB_CLIENT_SECRET: "test-secret",
	},
}));
vi.mock("../../server/github.ts", () => ({
	checkGithubOrgMember: vi.fn(async () => true),
}));

test("upgraded auth supports registration, GitHub token selection and resource metadata", async () => {
	const sqlite = new Database(":memory:");
	try {
		const dir = new URL("../../../drizzle/", import.meta.url);
		for (const name of readdirSync(dir)
			.filter((name) => name.endsWith(".sql"))
			.sort()) {
			sqlite.exec(readFileSync(new URL(name, dir), "utf8"));
		}
		const db = drizzle(sqlite, { schema });
		const auth = betterAuth({
			...createAuthOptions(),
			emailAndPassword: { enabled: true },
			secret: "test-only-auth-upgrade-secret-at-least-32-characters",
			database: drizzleAdapter(db, {
				provider: "sqlite",
			}),
		});
		const signup = await auth.handler(
			new Request("http://localhost:3907/api/auth/sign-up/email", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost:3907",
				},
				body: JSON.stringify({
					name: "Member",
					email: "member@example.com",
					password: "test-only-password-123",
				}),
			}),
		);
		expect(signup.status).toBe(200);
		const signupData = (await signup.json()) as { user: { id: string } };
		const headers = new Headers({
			cookie: signup.headers
				.getSetCookie()
				.map((cookie) => cookie.split(";")[0])
				.join("; "),
		});
		// The local row id deliberately differs from the external provider subject.
		sqlite
			.prepare(
				"INSERT INTO account (id, account_id, provider_id, user_id, access_token, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.run(
				"local-github-row",
				"external-github-subject",
				"github",
				signupData.user.id,
				"test-github-token",
				Date.now(),
			);
		const access = await verifyOrgAccess(
			auth,
			db as unknown as DBClient,
			headers,
			"test-org",
		);
		expect(access.ok).toBe(true);
		expect(checkGithubOrgMember).toHaveBeenCalledWith(
			"test-github-token",
			"test-org",
		);
		await verifyOrgAccess(auth, db as unknown as DBClient, headers, "TEST-ORG");
		expect(checkGithubOrgMember).toHaveBeenCalledTimes(1);
		const cacheEntry = sqlite
			.prepare("SELECT expires_at FROM github_org_membership")
			.get() as { expires_at: number };
		expect(cacheEntry.expires_at - Date.now()).toBeGreaterThan(
			(AUTH_CACHE_SECONDS - 5) * 1000,
		);
		sqlite.prepare("UPDATE github_org_membership SET expires_at = 0").run();
		await verifyOrgAccess(auth, db as unknown as DBClient, headers, "test-org");
		expect(checkGithubOrgMember).toHaveBeenCalledTimes(2);
		const session = sqlite.prepare("SELECT expires_at FROM session").get() as {
			expires_at: number;
		};
		expect(session.expires_at - Date.now()).toBeGreaterThan(
			(tokenLifetimes.session - 5) * 1000,
		);
		expect(
			signup.headers
				.getSetCookie()
				.some(
					(cookie) =>
						cookie.includes("session_data=") && cookie.includes("Max-Age=600"),
				),
		).toBe(true);

		const sessionRead = vi.spyOn(sqlite, "prepare");
		await auth.api.getSession({ headers });
		await auth.api.getSession({ headers });
		expect(sessionRead).not.toHaveBeenCalled();
		sessionRead.mockRestore();

		// A fresh cache cannot authenticate an unsigned request.
		expect(
			await verifyOrgAccess(
				auth,
				db as unknown as DBClient,
				new Headers(),
				"test-org",
			),
		).toMatchObject({ ok: false, status: 401 });
		// Expired membership grants are refreshed, and denials never become grants.
		sqlite.prepare("UPDATE github_org_membership SET expires_at = 0").run();
		vi.mocked(checkGithubOrgMember).mockResolvedValueOnce(false);
		expect(
			await verifyOrgAccess(
				auth,
				db as unknown as DBClient,
				headers,
				"test-org",
			),
		).toMatchObject({ ok: false, status: 403 });
		vi.mocked(checkGithubOrgMember).mockResolvedValueOnce(false);
		const deniedAuthorize = await handleAuthRequest(
			new Request("http://localhost:3907/api/auth/oauth2/authorize", {
				headers,
			}),
			auth,
			db as unknown as DBClient,
		);
		expect(deniedAuthorize.status).toBe(403);
		const dcr = await auth.handler(
			new Request("http://localhost:3907/api/auth/oauth2/register", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{}",
			}),
		);
		expect(dcr.status).toBe(403);

		const registration = await handleAuthRequest(
			new Request("http://localhost:3907/api/auth/oauth2/create-client", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					cookie: headers.get("cookie") ?? "",
					origin: "http://localhost:3907",
				},
				body: JSON.stringify({
					client_name: "MCP integration test",
					redirect_uris: ["http://127.0.0.1/callback"],
					application_type: "native",
					token_endpoint_auth_method: "none",
					grant_types: ["authorization_code", "refresh_token"],
					response_types: ["code"],
					scope: "openid offline_access mcp:write",
					resources: ["http://localhost:3907/api/mcp"],
				}),
			}),
			auth,
			db as unknown as DBClient,
		);
		const registered = z
			.object({
				client_id: z.string(),
				token_endpoint_auth_method: z.string(),
				application_type: z.string(),
			})
			.parse(await registration.json());
		expect(registration.status, JSON.stringify(registered)).toBe(201);
		expect(registered).toMatchObject({
			token_endpoint_auth_method: "none",
			application_type: "native",
		});
		const clientList = await handleAuthRequest(
			new Request("http://localhost:3907/api/auth/oauth2/get-clients", {
				headers,
			}),
			auth,
			db as unknown as DBClient,
		);
		expect(clientList.status).toBe(200);
		expect(await clientList.json()).toMatchObject([
			{ client_id: registered.client_id },
		]);
		expect(
			sqlite.prepare("SELECT identifier FROM oauth_resource").all(),
		).toEqual([{ identifier: "http://localhost:3907/api/mcp" }]);
		const discovery = await auth.handler(
			new Request(
				"http://localhost:3907/.well-known/oauth-authorization-server/api/auth",
			),
		);
		const metadata = z
			.object({
				issuer: z.url(),
				registration_endpoint: z.url().optional(),
				client_id_metadata_document_supported: z.boolean().optional(),
			})
			.parse(await discovery.json());
		expect(metadata.issuer).toBe("http://localhost:3907/api/auth");
		expect(metadata.registration_endpoint).toBeUndefined();
		expect(metadata.client_id_metadata_document_supported).not.toBe(true);
		const resourceMetadata = await auth.handler(
			new Request(
				"http://localhost:3907/.well-known/oauth-protected-resource/api/mcp",
			),
		);
		expect(await resourceMetadata.json()).toMatchObject({
			resource: "http://localhost:3907/api/mcp",
			authorization_servers: [metadata.issuer],
			scopes_supported: ["mcp:write"],
		});

		// Exercise authorization code + PKCE and the actual token lifetimes.
		const verifier =
			"test-pkce-verifier-with-at-least-forty-three-characters-123456";
		const challenge = Buffer.from(
			await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
		).toString("base64url");
		const authorizeUrl = new URL(
			"http://localhost:3907/api/auth/oauth2/authorize",
		);
		authorizeUrl.search = new URLSearchParams({
			client_id: registered.client_id,
			redirect_uri: "http://127.0.0.1:4567/callback",
			response_type: "code",
			state: "test-state",
			code_challenge: challenge,
			code_challenge_method: "S256",
			scope: "openid offline_access mcp:write",
			resource: "http://localhost:3907/api/mcp",
		}).toString();
		const authorization = await handleAuthRequest(
			new Request(authorizeUrl, { headers }),
			auth,
			db as unknown as DBClient,
		);
		expect(authorization.status).toBe(302);
		expect(authorization.headers.get("location")).toContain("/consent");
		const cookies = new Map(
			headers
				.get("cookie")
				?.split("; ")
				.map((cookie) => [cookie.split("=")[0], cookie]),
		);
		for (const cookie of authorization.headers.getSetCookie())
			cookies.set(cookie.split("=")[0], cookie.split(";")[0]);
		const consentHeaders = new Headers({
			cookie: [...cookies.values()].join("; "),
			origin: "http://localhost:3907",
			"content-type": "application/json",
		});
		const consent = await handleAuthRequest(
			new Request("http://localhost:3907/api/auth/oauth2/consent", {
				method: "POST",
				headers: consentHeaders,
				body: JSON.stringify({
					accept: true,
					oauth_query: new URL(
						authorization.headers.get("location") ?? "",
						"http://localhost:3907",
					).search.slice(1),
				}),
			}),
			auth,
			db as unknown as DBClient,
		);
		const consentBody = z.object({ url: z.url() }).parse(await consent.json());
		expect(consent.status, JSON.stringify(consentBody)).toBe(200);
		const callback = new URL(consentBody.url);
		expect(callback.searchParams.get("iss")).toBe(metadata.issuer);
		const tokenResponse = await auth.handler(
			new Request("http://localhost:3907/api/auth/oauth2/token", {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "authorization_code",
					client_id: registered.client_id,
					code: callback.searchParams.get("code") ?? "",
					code_verifier: verifier,
					redirect_uri: "http://127.0.0.1:4567/callback",
					resource: "http://localhost:3907/api/mcp",
				}),
			}),
		);
		const tokens = z
			.object({
				access_token: z.string(),
				id_token: z.string(),
				refresh_token: z.string(),
				expires_in: z.number(),
				error_description: z.string().optional(),
			})
			.parse(await tokenResponse.json());
		expect(tokenResponse.status, tokens.error_description).toBe(200);
		expect(tokens.expires_in).toBe(tokenLifetimes.access);
		expect(tokens.refresh_token).toBeTypeOf("string");
		const idClaims = JSON.parse(
			Buffer.from(tokens.id_token.split(".")[1], "base64url").toString(),
		);
		expect(idClaims.exp - idClaims.iat).toBe(tokenLifetimes.id);
		const refreshRow = sqlite
			.prepare("SELECT expires_at, created_at FROM oauth_refresh_token")
			.get() as { expires_at: number; created_at: number };
		expect(refreshRow.expires_at - refreshRow.created_at).toBe(
			tokenLifetimes.refresh * 1000,
		);
		const mcpRequest = () =>
			new Request("http://localhost:3907/api/mcp", {
				method: "POST",
				headers: { authorization: `Bearer ${tokens.access_token}` },
			});
		const jwks = vi.spyOn(auth.api, "getJwks");
		expect((await authenticateMcpRequest(mcpRequest(), auth)).ok).toBe(true);
		expect((await authenticateMcpRequest(mcpRequest(), auth)).ok).toBe(true);
		expect(jwks).toHaveBeenCalledTimes(1);
		jwks.mockRestore();
		const mint = async (
			claims: Record<string, unknown>,
			audience = "http://localhost:3907/api/mcp",
			expires = tokenLifetimes.access,
		) =>
			(
				await auth.api.signJWT({
					body: {
						payload: {
							sub: signupData.user.id,
							azp: registered.client_id,
							scope: "mcp:write",
							...claims,
						},
						overrideOptions: {
							jwt: {
								issuer: metadata.issuer,
								audience,
								expirationTime: Math.floor(Date.now() / 1000) + expires,
							},
						},
					},
				})
			).token;
		const dpopKeys = await generateKeyPair("ES256");
		const publicJwk = await exportJWK(dpopKeys.publicKey);
		const boundToken = await mint({
			cnf: { jkt: await deriveDpopJkt(publicJwk) },
		});
		const proof = await new SignJWT({
			htm: "POST",
			htu: "http://localhost:3907/api/mcp",
			ath: await deriveDpopAth(boundToken),
		})
			.setProtectedHeader({ alg: "ES256", typ: "dpop+jwt", jwk: publicJwk })
			.setIssuedAt()
			.setJti(crypto.randomUUID())
			.sign(dpopKeys.privateKey);
		const boundRequest = () =>
			new Request("http://localhost:3907/api/mcp", {
				method: "POST",
				headers: { authorization: `DPoP ${boundToken}`, dpop: proof },
			});
		expect((await authenticateMcpRequest(boundRequest(), auth)).ok).toBe(true);
		const replay = await authenticateMcpRequest(boundRequest(), auth);
		expect(replay.ok).toBe(false);
		if (!replay.ok) {
			expect(replay.response.status).toBe(401);
			expect(replay.response.headers.get("www-authenticate")).toContain("DPoP");
		}
		for (const [token, status] of [
			["not-a-jwt", 401],
			[`${tokens.access_token.slice(0, -5)}aaaaa`, 401],
			[await mint({ scope: "openid" }), 403],
			[await mint({}, "https://other.example.com/mcp"), 401],
			[await mint({}, "http://localhost:3907/api/mcp", -1), 401],
			[await mint({ cnf: { jkt: "test-dpop-key" } }), 401],
			[tokens.id_token, 401],
		] as const) {
			const rejected = await authenticateMcpRequest(
				new Request("http://localhost:3907/api/mcp", {
					method: "POST",
					headers: { authorization: `Bearer ${token}` },
				}),
				auth,
			);
			expect(rejected.ok).toBe(false);
			if (!rejected.ok) expect(rejected.response.status).toBe(status);
		}
		const membershipChecks = vi.mocked(checkGithubOrgMember).mock.calls.length;
		const refreshResponse = await auth.handler(
			new Request("http://localhost:3907/api/auth/oauth2/token", {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "refresh_token",
					client_id: registered.client_id,
					refresh_token: tokens.refresh_token,
					resource: "http://localhost:3907/api/mcp",
				}),
			}),
		);
		expect(refreshResponse.status).toBe(200);
		expect(await refreshResponse.json()).toMatchObject({
			expires_in: tokenLifetimes.access,
			access_token: expect.any(String),
			refresh_token: expect.any(String),
		});
		expect(checkGithubOrgMember).toHaveBeenCalledTimes(membershipChecks);

		const anonymous = await authenticateMcpRequest(
			new Request("http://localhost:3907/api/mcp"),
			auth,
		);
		expect(anonymous.ok).toBe(false);
		if (!anonymous.ok) {
			expect(anonymous.response.status).toBe(401);
			expect(anonymous.response.headers.get("www-authenticate")).toContain(
				"resource_metadata",
			);
		}
	} finally {
		sqlite.close();
	}
});
