import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createFileRoute } from "@tanstack/react-router";
import { bearerMiddleware } from "#/middleware/bearer.ts";
import { nextSequence, rollbackSequence } from "#/server/sequence.ts";
import { handleMcpRequest } from "#/utils/mcp-handler";

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
		const sequence = await nextSequence();

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
		description: "Decrements today's centralized Flyway migration sequence by 1 only when the user explicitly requests to delete,撤回, rollback, or remove a previously allocated migration file/version. Never call this automatically after a generation failure, validation failure, or abandoned draft. Do not use this tool unless the user clearly instructs that a migration file/version should be removed or reverted.",
	},
	async () => {
		const sequence = await rollbackSequence();

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
