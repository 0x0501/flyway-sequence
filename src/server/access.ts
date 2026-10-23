import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { env } from "#/env.ts";
import { betterAuthMiddleware } from "#/middleware/better-auth.ts";
import { verifyOrgAccess } from "#/server/org-access.ts";

const githubAccessMiddleware = createMiddleware()
	.middleware([betterAuthMiddleware])
	.server(async ({ next, context, request }) => {
		const result = await verifyOrgAccess(
			context.auth,
			context.db,
			request.headers,
			env.GITHUB_ORGANIZATION,
		);

		return next({
			context: {
				authorized: result.ok,
			},
		});
	});

export const ensurePoolAccess = createServerFn()
	.middleware([githubAccessMiddleware])
	.handler(async ({ context }) => {
		return { authorized: context.authorized };
	});
