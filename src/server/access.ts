import { createMiddleware, createServerFn } from "@tanstack/react-start";
import type { Auth } from "better-auth";
import { env } from "#/env.ts";
import { betterAuthMiddleware } from "#/middleware/better-auth.ts";
import { verifyGithubOrgAccessForHeaders } from "#/server/mcp-access.ts";

const githubAccessMiddleware = createMiddleware()
	.middleware([betterAuthMiddleware])
	.server(async ({ next, context, request }) => {
		const result = await verifyGithubOrgAccessForHeaders(
			context.auth as unknown as Auth,
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
