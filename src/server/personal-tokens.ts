import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { createPersonalTokenInput } from "#/lib/personal-token-policy.ts";
import { protectedMiddleware } from "#/middleware/protected.ts";
import {
	createPersonalToken,
	listPersonalTokens,
	revokePersonalToken,
} from "#/services/personal-token.ts";

export const getPersonalTokens = createServerFn({ method: "GET" })
	.middleware([protectedMiddleware])
	.handler(async ({ context }) => {
		setResponseHeader("Cache-Control", "no-store");
		return listPersonalTokens(context.db, context.user.id);
	});

export const issuePersonalToken = createServerFn({ method: "POST" })
	.middleware([protectedMiddleware])
	.validator(createPersonalTokenInput)
	.handler(async ({ context, data }) => {
		setResponseHeader("Cache-Control", "no-store");
		return createPersonalToken(context.db, context.user.id, data);
	});

export const revokeToken = createServerFn({ method: "POST" })
	.middleware([protectedMiddleware])
	.validator(z.object({ tokenId: z.uuid() }))
	.handler(async ({ context, data }) => {
		setResponseHeader("Cache-Control", "no-store");
		await revokePersonalToken(context.db, context.user.id, data.tokenId);
		return { success: true };
	});
