import type { DBClient } from "#/db/client.ts";
import { env } from "#/env.ts";
import { verifyOrgAccess } from "./org-access.ts";

const memberPaths = new Set([
	"/api/auth/oauth2/authorize",
	"/api/auth/oauth2/consent",
	"/api/auth/oauth2/continue",
	"/api/auth/oauth2/create-client",
	"/api/auth/oauth2/get-client",
	"/api/auth/oauth2/get-clients",
	"/api/auth/oauth2/update-client",
	"/api/auth/oauth2/delete-client",
	"/api/auth/oauth2/client/rotate-secret",
]);

export async function handleAuthRequest(
	request: Request,
	auth: Parameters<typeof verifyOrgAccess>[0] & {
		handler: (request: Request) => Promise<Response>;
	},
	db: DBClient,
) {
	if (memberPaths.has(new URL(request.url).pathname)) {
		const access = await verifyOrgAccess(
			auth,
			db,
			request.headers,
			env.GITHUB_ORGANIZATION,
		);
		// Anonymous authorization requests must reach Better Auth's login redirect.
		if (!access.ok && access.status === 403) {
			return Response.json(
				{ error: "access_denied", error_description: access.message },
				{ status: 403 },
			);
		}
	}
	return auth.handler(request);
}
