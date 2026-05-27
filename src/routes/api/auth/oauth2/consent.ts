import { createFileRoute } from "@tanstack/react-router";
import type { Auth } from "better-auth";
import { env } from "#/env.ts";
import { betterAuthMiddleware } from "#/middleware/better-auth.ts";
import { verifyGithubOrgAccessForHeaders } from "#/server/mcp-access.ts";

type ConsentRequestBody = {
	accept?: boolean;
};

async function isAcceptingConsent(request: Request) {
	try {
		const body = (await request.clone().json()) as ConsentRequestBody;
		return body.accept === true;
	} catch {
		return false;
	}
}

export const Route = createFileRoute("/api/auth/oauth2/consent")({
	server: {
		middleware: [betterAuthMiddleware],
		handlers: {
			POST: async ({ request, context }) => {
				const acceptingConsent = await isAcceptingConsent(request);

				if (!acceptingConsent) {
					return context.auth.handler(request);
				}

				const result = await verifyGithubOrgAccessForHeaders(
					context.auth as unknown as Auth,
					request.headers,
					env.GITHUB_ORGANIZATION,
				);

				if (!result.ok) {
					return Response.json(
						{
							error: result.code,
							message: result.message,
						},
						{ status: result.status },
					);
				}

				return context.auth.handler(request);
			},
		},
	},
});
