import { createMiddleware } from "@tanstack/react-start";
import type { JWTPayload } from "better-auth";
import { env } from "#/env.ts";
import { getAuthIssuer } from "#/lib/oauth-urls.ts";
import { serverClient } from "#/lib/server-client.ts";

const authIssuer = getAuthIssuer(env.BETTER_AUTH_URL);

function unauthorized() {
	return new Response(null, {
		status: 401,
		headers: {
			"WWW-Authenticate": `Bearer resource_metadata="${env.BETTER_AUTH_URL}/.well-known/oauth-protected-resource/api/mcp", scope="mcp:write"`,
			"Access-Control-Expose-Headers": "WWW-Authenticate",
		},
	});
}

export const bearerMiddleware = createMiddleware().server(
	async ({ next, request }) => {
		const header = request.headers.get("authorization");

		if (!header?.startsWith("Bearer ")) {
			return unauthorized();
		}

		const token = header.slice("Bearer ".length);

		let payload: JWTPayload;

		try {
			payload = await serverClient.verifyAccessToken(token, {
				verifyOptions: {
					issuer: authIssuer,
					audience: env.MCP_RESOURCE_URL,
				},
				jwksUrl: `${authIssuer}/jwks`,
				scopes: ["mcp:write"],
			});
		} catch {
			return unauthorized();
		}

		return next({
			context: {
				accessToken: token,
				accessTokenPayload: payload,
			},
		});
	},
);
