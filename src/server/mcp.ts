import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { SequenceResponse } from "./sequence.ts";

export type SequenceMcpDependencies = {
	allocateNextSequence: () => Promise<SequenceResponse>;
	rollbackLatestSequence: () => Promise<SequenceResponse>;
};

export function createSequenceMcpServer(dependencies: SequenceMcpDependencies) {
	const server = new McpServer({
		name: "flyway-sequence",
		version: "2.0.0",
		description: "Get the latest flyway migration sequence string.",
	});

	server.registerTool(
		"next_sequence",
		{
			title: "Allocate next Flyway migration version",
			inputSchema: z.object({}),
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: false,
				openWorldHint: false,
			},
			description:
				"Allocates the next centralized Flyway migration version for today's Shanghai date. Call this exactly once for each migration file that will be created. Combine the returned sequence prefix with the user-provided short_desc to create filenames like V20260501_001__add_order_table.sql. The sequence is centralized and atomic; do not manually calculate or reuse sequence numbers.",
		},
		async () => toolResult(await dependencies.allocateNextSequence()),
	);

	server.registerTool(
		"rollback_sequence",
		{
			title: "Rollback explicit Flyway migration version removal",
			inputSchema: z.object({}),
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: false,
				openWorldHint: false,
			},
			description:
				"Decrements today's centralized Flyway migration sequence by 1 only when the user explicitly requests to delete,撤回, rollback, or remove a previously allocated migration file/version. Never call this automatically after a generation failure, validation failure, or abandoned draft. Do not use this tool unless the user clearly instructs that a migration file/version should be removed or reverted.",
		},
		async () => toolResult(await dependencies.rollbackLatestSequence()),
	);

	return server;
}

function toolResult(sequence: SequenceResponse) {
	return {
		isError: !sequence.success,
		structuredContent: sequence,
		content: [{ type: "text" as const, text: JSON.stringify(sequence) }],
	};
}
