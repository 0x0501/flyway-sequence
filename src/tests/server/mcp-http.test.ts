import {
	Client,
	StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { expect, test, vi } from "vitest";
import { createSequenceMcpServer } from "../../server/mcp.ts";
import { createMcpRequestHandler } from "../../server/mcp-handler.ts";

const endpoint = "https://sequence.example.com/api/mcp";

function setup() {
	const allocate = vi.fn(async () => ({
		success: true,
		sequence: "V20261022_002__",
		message: null,
	}));
	const rollback = vi.fn(async () => ({
		success: false,
		sequence: null,
		message: "Already at minimum sequence",
	}));
	const factory = vi.fn(() =>
		createSequenceMcpServer({
			allocateNextSequence: allocate,
			rollbackLatestSequence: rollback,
		}),
	);
	const handle = createMcpRequestHandler(factory, endpoint);
	return { allocate, rollback, factory, handle };
}

function rpcRequest(body: unknown, headers: Record<string, string> = {}) {
	return new Request(endpoint, {
		method: "POST",
		headers: {
			host: "sequence.example.com",
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
			...headers,
		},
		body: JSON.stringify(
			typeof body === "object" &&
				body !== null &&
				"method" in body &&
				body.method !== "notifications/initialized"
				? {
						...body,
						params: {
							...("params" in body &&
							typeof body.params === "object" &&
							body.params !== null
								? body.params
								: {}),
							_meta: {
								"io.modelcontextprotocol/protocolVersion": "2026-07-28",
								"io.modelcontextprotocol/clientCapabilities": {},
							},
						},
					}
				: body,
		),
	});
}

// Exercise the actual SDK client, HTTP transport, and application tool factory.
test("SDK client can discover and call tools using the 2026-07-28 protocol", async () => {
	const { handle, allocate, rollback, factory } = setup();
	const client = new Client(
		{ name: "integration-test", version: "1.0.0" },
		{
			versionNegotiation: {
				mode: { pin: "2026-07-28" },
			},
		},
	);
	const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
		fetch: (url, init) => {
			const request = new Request(url, init);
			request.headers.set("host", new URL(request.url).host);
			return handle(request);
		},
	});
	try {
		await client.connect(transport);
		expect(client.getProtocolEra()).toBe("modern");
		const tools = await client.listTools();
		expect(tools.tools.map((tool) => tool.name)).toEqual([
			"next_sequence",
			"rollback_sequence",
		]);
		expect(tools.tools[1].annotations?.destructiveHint).toBe(true);
		const allocated = await client.callTool({
			name: "next_sequence",
			arguments: {},
		});
		expect(allocated.content).toEqual([
			{
				type: "text",
				text: JSON.stringify(await allocate.mock.results[0].value),
			},
		]);
		const rolledBack = await client.callTool({ name: "rollback_sequence" });
		expect(rolledBack.isError).toBe(true);
		expect(allocate).toHaveBeenCalledTimes(1);
		expect(rollback).toHaveBeenCalledTimes(1);
		expect(factory.mock.results.length).toBeGreaterThanOrEqual(3);
		expect(
			new Set(factory.mock.results.map((result) => result.value)).size,
		).toBe(factory.mock.results.length);
	} finally {
		await client.close();
	}
});

test("legacy requests are rejected", async () => {
	const { handle, allocate } = setup();
	const response = await handle(
		new Request(endpoint, {
			method: "POST",
			headers: {
				host: "sequence.example.com",
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-11-25",
					capabilities: {},
					clientInfo: { name: "old-client", version: "1.0.0" },
				},
			}),
		}),
	);
	expect(response.status).toBe(400);
	expect(allocate).not.toHaveBeenCalled();
});

test("malformed JSON returns the SDK parse error", async () => {
	const { handle, allocate } = setup();
	const request = rpcRequest(null);
	const response = await handle(
		new Request(request.url, {
			method: "POST",
			headers: request.headers,
			body: "{",
		}),
	);
	expect(response.status).toBe(400);
	expect(await response.json()).toMatchObject({ error: { code: -32700 } });
	expect(allocate).not.toHaveBeenCalled();
});

test.each([null, [], { jsonrpc: "2.0", id: 1 }])(
	"invalid JSON-RPC payload is rejected without running a tool: %j",
	async (body) => {
		const { handle, allocate } = setup();
		const response = await handle(rpcRequest(body));
		expect(response.status).toBe(400);
		expect(allocate).not.toHaveBeenCalled();
	},
);

test("notifications are acknowledged without a response body", async () => {
	const { handle } = setup();
	const response = await handle(
		rpcRequest({ jsonrpc: "2.0", method: "notifications/initialized" }),
	);
	expect(response.status).toBe(202);
	expect(await response.text()).toBe("");
});

test.each<Record<string, string>>([
	{ host: "attacker.example" },
	{ origin: "https://attacker.example" },
])(
	"untrusted host or origin is rejected before server creation: %j",
	async (headers) => {
		const { handle, factory } = setup();
		const response = await handle(
			rpcRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, headers),
		);
		expect(response.status).toBe(403);
		expect(factory).not.toHaveBeenCalled();
	},
);

test("oversized requests are rejected before server creation", async () => {
	const { handle, factory } = setup();
	const response = await handle(
		rpcRequest({}, { "content-length": String(5 * 1024 * 1024) }),
	);
	expect(response.status).toBe(413);
	expect(factory).not.toHaveBeenCalled();
});
