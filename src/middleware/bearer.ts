import { createMiddleware } from "@tanstack/react-start";
import type { JWTPayload } from "better-auth";
import { verifyJwsAccessToken } from "better-auth/oauth2";
import { env } from "#/env.ts";
import { getAuthIssuer } from "#/lib/oauth-urls.ts";
import { betterAuthMiddleware } from "./better-auth.ts";

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

export const bearerMiddleware = createMiddleware()
	.middleware([betterAuthMiddleware])
	.server(async ({ next, request, context }) => {
		const header = request.headers.get("authorization");

		if (!header?.startsWith("Bearer ")) {
			return unauthorized();
		}

		const token = header.slice("Bearer ".length);

		let payload: JWTPayload;

		try {
			// Verify locally with keys read from the same D1 the auth server uses.
			// A Worker cannot fetch its own custom domain, so a remote jwksUrl
			// (createRemoteJWKSet) self-loopback fails — read the JWKS in-process.

			payload = await verifyJwsAccessToken(token, {
				jwksFetch: () => context.auth.api.getJwks(),
				verifyOptions: {
					issuer: authIssuer,
					audience: env.MCP_RESOURCE_URL,
				},
			});
		} catch (error) {
			console.error("MCP bearer auth: verifyAccessToken failed", error);
			return unauthorized();
		}

		const scopes = new Set((payload.scope as string | undefined)?.split(" "));
		if (!scopes.has("mcp:write")) {
			return unauthorized();
		}

		return next({
			context: {
				accessToken: token,
				accessTokenPayload: payload,
			},
		});
	});
