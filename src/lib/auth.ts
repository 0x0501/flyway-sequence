import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import type { DBClient } from "#/db/client.ts";
import { env } from "#/env.ts";

export function createAuthServer(db: DBClient) {
	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
		}),
		disabledPaths: ["/token"],
		emailAndPassword: {
			enabled: true,
		},
		socialProviders: {
			github: {
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
				scopes: ["user:email", "user:email", "read:org"],
			},
		},
		plugins: [
			jwt(),
			oauthProvider({
				loginPage: "/sign-in",
				consentPage: "/consent",
				validAudiences: [env.MCP_RESOURCE_URL],
				scopes: ["openid", "profile", "email", "mcp:read", "mcp:write"],
				allowDynamicClientRegistration: true,
				allowUnauthenticatedClientRegistration: true,
				clientRegistrationDefaultScopes: [
					"openid",
					"profile",
					"email",
					"mcp:read",
				],
				clientRegistrationAllowedScopes: [
					"openid",
					"profile",
					"email",
					"mcp:read",
					"mcp:write",
				],
			}),
			tanstackStartCookies(),
		],
	});
}

// For better auth schema generation
export const auth = createAuthServer({} as DBClient);
