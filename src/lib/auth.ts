import { mcp } from "@better-auth/mcp";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import type { DBClient } from "#/db/client.ts";
import { env } from "#/env.ts";
import {
	AUTH_CACHE_SECONDS,
	oauthScopes,
	tokenLifetimes,
} from "./auth-policy.ts";

export function createAuthOptions() {
	return {
		baseURL: env.BETTER_AUTH_URL,
		disabledPaths: ["/token"],
		session: {
			expiresIn: tokenLifetimes.session,
			cookieCache: { enabled: true, maxAge: AUTH_CACHE_SECONDS },
		},
		socialProviders: {
			github: {
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
				scope: ["user:email", "read:org"],
			},
		},
		plugins: [
			jwt({
				jwt: { expirationTime: `${tokenLifetimes.access}s` },
				disableSettingJwtHeader: true,
			}),
			mcp({
				loginPage: "/sign-in",
				consentPage: "/consent",
				resource: env.MCP_RESOURCE_URL,
				allowDynamicClientRegistration: false,
				grantTypes: ["authorization_code", "refresh_token"],
				scopes: [...oauthScopes],
				accessTokenExpiresIn: tokenLifetimes.access,
				idTokenExpiresIn: tokenLifetimes.id,
				codeExpiresIn: tokenLifetimes.authorizationCode,
				refreshTokenExpiresIn: tokenLifetimes.refresh,
			}),
			tanstackStartCookies(),
		],
	} satisfies BetterAuthOptions;
}

export function createAuthServer(db: DBClient) {
	return betterAuth({
		...createAuthOptions(),
		database: drizzleAdapter(db, { provider: "sqlite" }),
	});
}
