import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { APIError } from "better-auth/api";
import {
	createDpopReplayStore,
	createInsufficientScopeError,
	enforceDpopBinding,
	isDpopBindingError,
	parseAccessTokenAuthorization,
	verifyJwsAccessToken,
} from "better-auth/oauth2";
import { errors } from "jose";
import { env } from "#/env.ts";
import type { createAuthServer } from "#/lib/auth.ts";
import { getAuthIssuer } from "#/lib/oauth-urls.ts";

// Public keys only; Better Auth owns TTL, concurrent fetches and key-rotation refresh.
const jwksCacheKey = {};

function invalidToken() {
	return new APIError("UNAUTHORIZED", {
		message: "A valid MCP access token is required.",
		error: "invalid_token",
		error_description: "A valid MCP access token is required.",
	});
}

export async function authenticateMcpRequest(
	request: Request,
	auth: {
		api: Pick<ReturnType<typeof createAuthServer>["api"], "getJwks">;
		$context: Promise<{
			internalAdapter: Parameters<typeof createDpopReplayStore>[0];
		}>;
	},
): Promise<
	{ ok: true; authInfo: AuthInfo } | { ok: false; response: Response }
> {
	try {
		const authorization = parseAccessTokenAuthorization(
			request.headers.get("authorization"),
		);
		if (!authorization || authorization.scheme === "Unknown")
			throw invalidToken();
		// Read local JWKS in-process: Workers cannot fetch their own custom domain.
		const payload = await verifyJwsAccessToken(authorization.token, {
			jwksFetch: () => auth.api.getJwks(),
			jwksCacheKey,
			verifyOptions: {
				issuer: getAuthIssuer(env.BETTER_AUTH_URL),
				audience: env.MCP_RESOURCE_URL,
				requiredClaims: ["exp", "azp"],
			},
		});
		if (typeof payload.azp !== "string" || typeof payload.exp !== "number")
			throw invalidToken();
		await enforceDpopBinding({
			payload,
			authorization,
			proofJwt: request.headers.get("dpop"),
			method: request.method,
			url: request.url,
			replayStore:
				authorization.scheme === "DPoP"
					? createDpopReplayStore((await auth.$context).internalAdapter)
					: undefined,
		});
		const scopes =
			typeof payload.scope === "string" ? payload.scope.split(" ") : [];
		if (!scopes.includes("mcp:write"))
			throw createInsufficientScopeError(["mcp:write"]);
		return {
			ok: true,
			authInfo: {
				token: authorization.token,
				clientId: payload.azp,
				scopes,
				expiresAt: payload.exp,
				resource: new URL(env.MCP_RESOURCE_URL),
			},
		};
	} catch (error) {
		// Token failures challenge the client; key-store and transport failures stay 500s.
		const tokenFailure =
			error instanceof errors.JOSEError &&
			!(error instanceof errors.JWKSTimeout) &&
			!(error instanceof errors.JWKSInvalid) &&
			!(error instanceof errors.JWKSMultipleMatchingKeys);
		const challenge = createResourceServerChallenge(
			isDpopBindingError(error)
				? new APIError("UNAUTHORIZED", {
						message: error.message,
						error: error.code,
						error_description: error.message,
					})
				: tokenFailure
					? invalidToken()
					: error,
			env.MCP_RESOURCE_URL,
			{ challengeScopes: ["mcp:write"] },
		);
		if (!challenge) throw error;
		return {
			ok: false,
			response: Response.json(
				{ error: challenge.message },
				{ status: challenge.statusCode, headers: challenge.headers },
			),
		};
	}
}
