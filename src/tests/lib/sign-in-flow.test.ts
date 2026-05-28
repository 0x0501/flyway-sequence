import { describe, expect, test } from "vitest";
import {
	getAuthorizationResumePath,
	isAuthorizationRequest,
} from "../../lib/sign-in-flow.ts";

describe("isAuthorizationRequest", () => {
	test("true when all OAuth params are present", () => {
		const params = new URLSearchParams({
			client_id: "abc",
			redirect_uri: "https://example.com/cb",
			response_type: "code",
			state: "xyz",
		});
		expect(isAuthorizationRequest(params)).toBe(true);
	});

	test("false when any OAuth param is missing", () => {
		const params = new URLSearchParams({
			client_id: "abc",
			redirect_uri: "https://example.com/cb",
			response_type: "code",
		});
		expect(isAuthorizationRequest(params)).toBe(false);
	});

	test("false for an empty param set", () => {
		expect(isAuthorizationRequest(new URLSearchParams())).toBe(false);
	});
});

describe("getAuthorizationResumePath", () => {
	test("returns the authorize endpoint for an OAuth request", () => {
		const params = new URLSearchParams({
			client_id: "abc",
			redirect_uri: "https://example.com/cb",
			response_type: "code",
			state: "xyz",
		});
		expect(getAuthorizationResumePath(params)).toBe(
			`/api/auth/oauth2/authorize?${params.toString()}`,
		);
	});

	test("returns returnTo when not an OAuth request", () => {
		const params = new URLSearchParams({ returnTo: "/pool" });
		expect(getAuthorizationResumePath(params)).toBe("/pool");
	});
});
