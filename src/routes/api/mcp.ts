import { env } from "cloudflare:workers";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createFileRoute } from "@tanstack/react-router";
import { createDatabaseClient } from "#/db/client.ts";
import { bearerMiddleware } from "#/middleware/bearer.ts";
import type { SequenceResponse } from "#/server/sequence.ts";
import {
	getSequenceHandler,
	padSequence,
	rollbackSequenceHandler,
} from "#/services/sequence.ts";
import { handleMcpRequest } from "#/utils/mcp-handler";

// The POST route is already gated by bearerMiddleware, so the tool handlers
// invoke the service layer directly with the D1 binding. They must NOT call the
// TanStack server functions (nextSequence/rollbackSequence): those re-run
// request-scoped middleware (auth) that has no HTTP request context here.
async function allocateNextSequence(): Promise<SequenceResponse> {
	try {
		const db = createDatabaseClient(env.DB);
		const res = await getSequenceHandler({ db, date: new Date() });
		return {
			success: true,
			sequence: `V${res.sequenceDate}_${padSequence(res.sequence)}__`,
			message: null,
		};
	} catch (e) {
		return { success: false, sequence: null, message: (e as Error).message };
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
	} catch (e) {
		return { success: false, sequence: null, message: (e as Error).message };
	}
}

const server = new McpServer({
	name: "flyway-sequence",
	version: "1.0.0",
	description: "Get the latest flyway migration sequence string.",
});

server.registerTool(
	"next_sequence",
	{
		title: "Allocate next Flyway migration version",
		description:
			"Allocates the next centralized Flyway migration version for today's Shanghai date. Call this exactly once for each migration file that will be created. Combine the returned sequenceDate and sequence with the user-provided short_desc to create filenames like V20260501_001__add_order_table.sql. The sequence is centralized and atomic; do not manually calculate or reuse sequence numbers.",
	},
	async () => {
		const sequence = await allocateNextSequence();

		if (sequence.success) {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(sequence),
					},
				],
			};
		} else {
			return {
				isError: true,
				content: [
					{
						type: "text",
						text: JSON.stringify(sequence),
					},
				],
			};
		}
	},
);

server.registerTool(
	"rollback_sequence",
	{
		title: "Rollback explicit Flyway migration version removal",
		description:
			"Decrements today's centralized Flyway migration sequence by 1 only when the user explicitly requests to delete,撤回, rollback, or remove a previously allocated migration file/version. Never call this automatically after a generation failure, validation failure, or abandoned draft. Do not use this tool unless the user clearly instructs that a migration file/version should be removed or reverted.",
	},
	async () => {
		const sequence = await rollbackLatestSequence();

		if (sequence.success) {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(sequence),
					},
				],
			};
		} else {
			return {
				isError: true,
				content: [
					{
						type: "text",
						text: JSON.stringify(sequence),
					},
				],
			};
		}
	},
);

export const Route = createFileRoute("/api/mcp")({
	server: {
		middleware: [bearerMiddleware],
		handlers: {
			POST: async ({ request }) => handleMcpRequest(request, server),
		},
	},
});
