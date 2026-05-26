import { env } from "cloudflare:workers";
import { createMiddleware } from "@tanstack/react-start";
import { createDatabaseClient } from "#/db/client.ts";

export const databaseMiddleware = createMiddleware().server(({ next }) => {
	const client = createDatabaseClient(env.DB);
	return next({
		context: {
			db: client,
		},
	});
});
