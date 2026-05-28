import { expect, test } from "vitest";

import { getAuthIssuer } from "../../lib/oauth-urls.ts";

test("getAuthIssuer appends the Better Auth issuer path", () => {
	expect(getAuthIssuer("http://localhost:3000")).toBe(
		"http://localhost:3000/api/auth",
	);
	expect(getAuthIssuer("http://localhost:3000/")).toBe(
		"http://localhost:3000/api/auth",
	);
});
