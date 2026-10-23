import { createFileRoute } from "@tanstack/react-router";
import { betterAuthMiddleware } from "#/middleware/better-auth.ts";
import { handleAuthRequest } from "#/server/auth-request.ts";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		middleware: [betterAuthMiddleware],
		handlers: {
			GET: ({ request, context }) =>
				handleAuthRequest(request, context.auth, context.db),
			POST: ({ request, context }) =>
				handleAuthRequest(request, context.auth, context.db),
		},
	},
});
