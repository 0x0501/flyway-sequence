import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "#/env.ts";

export const auth = betterAuth({
	emailAndPassword: {
		enabled: true,
	},
	github: {
		clientId: env.GITHUB_CLIENT_ID,
		clientSecret: env.GITHUB_CLIENT_SECRET
	},
	plugins: [tanstackStartCookies()],
});
