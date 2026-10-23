import {
	createMcpHandler,
	hostHeaderValidationResponse,
	type McpHandlerRequestOptions,
	type McpServerFactory,
	originValidationResponse,
} from "@modelcontextprotocol/server";

export function createMcpRequestHandler(
	factory: McpServerFactory,
	resourceUrl: string,
) {
	const handler = createMcpHandler(factory, { legacy: "reject" });
	const hostnames = [new URL(resourceUrl).hostname];
	return (request: Request, options?: McpHandlerRequestOptions) => {
		const rejected =
			hostHeaderValidationResponse(request, hostnames) ??
			originValidationResponse(request, hostnames);
		return rejected
			? Promise.resolve(rejected)
			: handler.fetch(request, options);
	};
}
