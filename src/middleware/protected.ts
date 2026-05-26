import { createMiddleware } from "@tanstack/react-start";
import { betterAuthMiddleware } from "./better-auth";

export const protectedMiddleware = createMiddleware()
	.middleware([betterAuthMiddleware])
	.server(async ({ next, context, request }) => {
		const session = await context.auth.api.getSession({
			headers: request.headers,
		});

		if (!session) {
			return Response.json({ error: "Not authenticated" }, { status: 401 });
		}
		return next({
			context: {
				session,
				user: session.user,
			},
		});
	});
