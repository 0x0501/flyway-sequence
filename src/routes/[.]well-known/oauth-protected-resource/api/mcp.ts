import { createFileRoute } from "@tanstack/react-router";
import { env } from "#/env.ts";
import { getAuthIssuer } from "#/lib/oauth-urls.ts";
import { serverClient } from "#/lib/server-client.ts";

const authIssuer = getAuthIssuer(env.BETTER_AUTH_URL);

export const Route = createFileRoute(
	"/.well-known/oauth-protected-resource/api/mcp",
)({
	server: {
		handlers: {
			GET: async () => {
				const metadata = await serverClient.getProtectedResourceMetadata({
					resource: env.MCP_RESOURCE_URL,
					authorization_servers: [authIssuer],
				});

				return new Response(JSON.stringify(metadata), {
					headers: {
						"Content-Type": "application/json",
						"Cache-Control":
							"public, max-age=15, stale-while-revalidate=15, stale-if-error=86400",

						// 本地 MCP Inspector 测试时可加
						"Access-Control-Allow-Origin": "*",
						"Access-Control-Allow-Methods": "GET",
					},
				});
			},
		},
	},
});
