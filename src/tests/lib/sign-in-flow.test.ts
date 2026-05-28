import { describe, expect, test } from "vitest";

import {
	buildSignInRoute,
	getAuthorizationResumePath,
	isAuthorizationRequest,
} from "../../lib/sign-in-flow.ts";

describe("buildSignInRoute", () => {
	test("preserves a return target for app logins", () => {
		expect(buildSignInRoute("/")).toBe("/sign-in?returnTo=%2F");
		expect(buildSignInRoute("/dashboard?tab=tools")).toBe(
			"/sign-in?returnTo=%2Fdashboard%3Ftab%3Dtools",
		);
	});
});

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

	test("false when client_id is missing", () => {
		const params = new URLSearchParams({
			redirect_uri: "https://example.com/cb",
			response_type: "code",
			state: "xyz",
		});
		expect(isAuthorizationRequest(params)).toBe(false);
	});

	test("false when state is missing", () => {
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
	test("rebuilds the authorize URL when oauth params are present", () => {
		const search = new URLSearchParams({
			client_id: "abc",
			redirect_uri: "http://localhost:6274/oauth/callback/debug",
			response_type: "code",
			state: "xyz",
			scope: "openid profile",
		});

		expect(getAuthorizationResumePath(search)).toBe(
			"/api/auth/oauth2/authorize?client_id=abc&redirect_uri=http%3A%2F%2Flocalhost%3A6274%2Foauth%2Fcallback%2Fdebug&response_type=code&state=xyz&scope=openid+profile",
		);
	});

	test("falls back to app return target when oauth params are absent", () => {
		const search = new URLSearchParams({
			returnTo: "/settings",
		});

		expect(getAuthorizationResumePath(search)).toBe("/settings");
		expect(getAuthorizationResumePath(new URLSearchParams())).toBeNull();
	});
});
