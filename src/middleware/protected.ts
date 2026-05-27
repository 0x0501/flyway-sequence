import { createMiddleware } from "@tanstack/react-start";
import type { Auth } from "better-auth";
import { env } from "#/env.ts";
import { verifyGithubOrgAccessForHeaders } from "#/server/mcp-access.ts";
import { betterAuthMiddleware } from "./better-auth";

export const protectedMiddleware = createMiddleware()
	.middleware([betterAuthMiddleware])
	.server(async ({ next, context, request }) => {
		const result = await verifyGithubOrgAccessForHeaders(
			context.auth as unknown as Auth,
			request.headers,
			env.GITHUB_ORGANIZATION,
		);

		if (!result.ok) {
			return Response.json(
				{ error: result.message },
				{ status: result.status },
			);
		}

		return next({
			context: {
				session: result.session,
				user: result.session.user,
			},
		});
	});
