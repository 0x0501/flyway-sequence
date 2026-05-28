import { expect, test } from "vitest";

import { getErrorMessage } from "../../lib/error-message.ts";

test("getErrorMessage prefers a top-level response payload message", () => {
	expect(
		getErrorMessage(
			{
				data: {
					message: "Only GitHub organization members can authorize MCP access.",
				},
				message: "Forbidden",
			},
			"fallback",
		),
	).toBe("Only GitHub organization members can authorize MCP access.");
});

test("getErrorMessage falls back to nested error message", () => {
	expect(
		getErrorMessage(
			{
				error: {
					message: "Forbidden",
				},
			},
			"fallback",
		),
	).toBe("Forbidden");
});

test("getErrorMessage returns fallback when there is no usable message", () => {
	expect(getErrorMessage({}, "fallback")).toBe("fallback");
});
