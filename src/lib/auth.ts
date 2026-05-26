import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import type { DBClient } from "#/db/client.ts";
import { env } from "#/env.ts";

export function createAuthServer(db: DBClient) {
	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
		}),
		emailAndPassword: {
			enabled: true,
		},
		socialProviders: {
			github: {
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
			},
		},
		plugins: [tanstackStartCookies()],
	});
}

// For better auth schema generation
export const auth = createAuthServer({} as DBClient);
