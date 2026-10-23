import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { createDatabaseClient } from "#/db/client.ts";
import { env as appEnv } from "#/env.ts";
import { getErrorMessage } from "#/lib/error-message.ts";
import { betterAuthMiddleware } from "#/middleware/better-auth.ts";
import { createSequenceMcpServer } from "#/server/mcp.ts";
import { authenticateMcpRequest } from "#/server/mcp-auth.ts";
import { createMcpRequestHandler } from "#/server/mcp-handler";
import type { SequenceResponse } from "#/server/sequence.ts";
import {
	getSequenceHandler,
	padSequence,
	rollbackSequenceHandler,
} from "#/services/sequence.ts";

async function allocateNextSequence(): Promise<SequenceResponse> {
	try {
		const db = createDatabaseClient(env.DB);
		const res = await getSequenceHandler({ db, date: new Date() });
		return {
			success: true,
			sequence: `V${res.sequenceDate}_${padSequence(res.sequence)}__`,
			message: null,
		};
	} catch (error) {
		return {
			success: false,
			sequence: null,
			message: getErrorMessage(error, "Could not allocate a sequence."),
		};
	}
}

async function rollbackLatestSequence(): Promise<SequenceResponse> {
	try {
		const db = createDatabaseClient(env.DB);
		const res = await rollbackSequenceHandler({ db, date: new Date() });
		return {
			success: true,
			sequence: `V${res.sequenceDate}_${padSequence(res.sequence)}__`,
			message: null,
		};
	} catch (error) {
		return {
			success: false,
			sequence: null,
			message: getErrorMessage(error, "Could not roll back the sequence."),
		};
	}
}

// The SDK creates and closes a separate server for each HTTP request.
const handleMcpRequest = createMcpRequestHandler(
	() =>
		createSequenceMcpServer({ allocateNextSequence, rollbackLatestSequence }),
	appEnv.MCP_RESOURCE_URL,
);

export const Route = createFileRoute("/api/mcp")({
	server: {
		middleware: [betterAuthMiddleware],
		handlers: {
			POST: async ({ request, context }) => {
				const access = await authenticateMcpRequest(request, context.auth);
				if (!access.ok) return access.response;
				return handleMcpRequest(request, { authInfo: access.authInfo });
			},
		},
	},
});
