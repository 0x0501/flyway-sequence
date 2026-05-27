import assert from "node:assert/strict";
import test from "node:test";

import { getErrorMessage } from "../../lib/error-message.ts";

test("getErrorMessage prefers a top-level response payload message", () => {
	assert.equal(
		getErrorMessage(
			{
				data: {
					message: "Only GitHub organization members can authorize MCP access.",
				},
				message: "Forbidden",
			},
			"fallback",
		),
		"Only GitHub organization members can authorize MCP access.",
	);
});

test("getErrorMessage falls back to nested error message", () => {
	assert.equal(
		getErrorMessage(
			{
				error: {
					message: "Forbidden",
				},
			},
			"fallback",
		),
		"Forbidden",
	);
});

test("getErrorMessage returns fallback when there is no usable message", () => {
	assert.equal(getErrorMessage({}, "fallback"), "fallback");
});
