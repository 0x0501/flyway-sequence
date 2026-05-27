import assert from "node:assert/strict";
import test from "node:test";

import { getAuthIssuer } from "../../lib/oauth-urls.ts";

test("getAuthIssuer appends the Better Auth issuer path", () => {
	assert.equal(
		getAuthIssuer("http://localhost:3000"),
		"http://localhost:3000/api/auth",
	);
	assert.equal(
		getAuthIssuer("http://localhost:3000/"),
		"http://localhost:3000/api/auth",
	);
});
