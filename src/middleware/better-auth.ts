import { createMiddleware } from "@tanstack/react-start";
import { createAuthServer } from "#/lib/auth.ts";
import { databaseMiddleware } from "./database";

export const betterAuthMiddleware = createMiddleware()
	.middleware([databaseMiddleware])
	.server(({ next, context }) => {
		const auth = createAuthServer(context.db);
		return next({
			context: {
				auth,
			},
		});
	});
