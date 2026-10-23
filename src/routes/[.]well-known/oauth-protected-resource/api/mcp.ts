import { createFileRoute } from "@tanstack/react-router";
import { betterAuthMiddleware } from "#/middleware/better-auth.ts";

export const Route = createFileRoute(
	"/.well-known/oauth-protected-resource/api/mcp",
)({
	server: {
		middleware: [betterAuthMiddleware],
		handlers: { GET: ({ request, context }) => context.auth.handler(request) },
	},
});
