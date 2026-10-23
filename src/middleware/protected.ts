import { createMiddleware } from "@tanstack/react-start";
import { env } from "#/env.ts";
import { verifyOrgAccess } from "#/server/org-access.ts";
import { betterAuthMiddleware } from "./better-auth";

export const protectedMiddleware = createMiddleware()
	.middleware([betterAuthMiddleware])
	.server(async ({ next, context, request }) => {
		const result = await verifyOrgAccess(
			context.auth,
			context.db,
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
