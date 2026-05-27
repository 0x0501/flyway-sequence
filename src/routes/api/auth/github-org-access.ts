import { createFileRoute } from "@tanstack/react-router";
import { env } from "#/env.ts";
import { betterAuthMiddleware } from "#/middleware/better-auth.ts";
import { verifyGithubOrgAccessForHeaders } from "#/server/mcp-access.ts";

export const Route = createFileRoute("/api/auth/github-org-access")({
	server: {
		middleware: [betterAuthMiddleware],
		handlers: {
			GET: async ({ context, request }) => {
				const result = await verifyGithubOrgAccessForHeaders(
					context.auth,
					request.headers,
					env.GITHUB_ORGANIZATION,
				);

				if (!result.ok) {
					return Response.json(
						{
							authorized: false,
							code: result.code,
							message: result.message,
						},
						{ status: result.status },
					);
				}

				return Response.json({
					authorized: true,
					user: result.session.user,
				});
			},
		},
	},
});
