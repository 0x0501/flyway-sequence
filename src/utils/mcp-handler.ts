import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'

export async function handleMcpRequest(
  request: Request,
  server: McpServer,
): Promise<Response> {
  try {
    const jsonRpcRequest = (await request.json()) as JSONRPCMessage

    // Some clients send `arguments: null` for no-parameter tool calls. The SDK's
    // CallToolRequestSchema expects an object (or omitted), and rejects null
    // before tool-level validation. Coerce null/undefined to an empty object.
    if (
      "method" in jsonRpcRequest &&
      jsonRpcRequest.method === "tools/call" &&
      jsonRpcRequest.params &&
      jsonRpcRequest.params.arguments == null
    ) {
      jsonRpcRequest.params.arguments = {}
    }

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair()

    // A JSON-RPC request (has both `method` and an `id`) gets exactly one
    // response. Notifications (no `id`) get none. Await the actual response
    // rather than a fixed timeout — tool handlers do async I/O (D1) that takes
    // longer than any fixed wait, which previously caused a null response.
    const isRequest =
      'method' in jsonRpcRequest &&
      'id' in jsonRpcRequest &&
      jsonRpcRequest.id !== undefined &&
      jsonRpcRequest.id !== null

    const responsePromise = new Promise<JSONRPCMessage | null>((resolve) => {
      if (!isRequest) {
        resolve(null)
        return
      }
      clientTransport.onmessage = (message: JSONRPCMessage) => resolve(message)
    })

    await server.connect(serverTransport)

    await clientTransport.start()
    await serverTransport.start()

    await clientTransport.send(jsonRpcRequest)

    const TIMEOUT_MS = 25_000
    let timer: ReturnType<typeof setTimeout> | undefined
    const responseData = await Promise.race([
      responsePromise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('MCP request timed out')),
          TIMEOUT_MS,
        )
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer)
    })

    await clientTransport.close()
    await serverTransport.close()

    // Notifications produce no response body.
    if (responseData === null) {
      return new Response(null, { status: 202 })
    }

    return Response.json(responseData, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('MCP handler error:', error)

    // Return a JSON-RPC error response
    return Response.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : String(error),
        },
        id: null,
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
