import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { env } from "#/env.ts";
import { checkGithubOrgMember } from "#/server/github.ts";
import { betterAuthMiddleware } from "./better-auth";

export const protectedMiddleware = createMiddleware()
	.middleware([betterAuthMiddleware])
	.server(async ({ next, context, request }) => {
		const session = await context.auth.api.getSession({
			headers: request.headers,
		});

		if (!session) {
			return Response.json({ error: "Not authenticated" }, { status: 401 });
		}

		// check accessibility
		const headers = getRequestHeaders();

		const token = await context.auth.api.getAccessToken({
			body: {
				providerId: "github",
			},
			headers,
		});

		if (!token.accessToken) {
			throw new Error("GitHub access token not found");
		}

		const result = await checkGithubOrgMember(
			token.accessToken,
			env.GITHUB_ORGANIZATION,
		);

		if (!result) {
			return Response.json(
				{ error: "Not authenticated (Github Organization)" },
				{ status: 401 },
			);
		}

		return next({
			context: {
				session,
				user: session.user,
			},
		});
	});
