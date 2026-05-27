import assert from "node:assert/strict";
import test from "node:test";

import {
	buildSignInRoute,
	getAuthorizationResumePath,
} from "../../lib/sign-in-flow.ts";

test("buildSignInRoute preserves a return target for app logins", () => {
	assert.equal(buildSignInRoute("/"), "/sign-in?returnTo=%2F");
	assert.equal(
		buildSignInRoute("/dashboard?tab=tools"),
		"/sign-in?returnTo=%2Fdashboard%3Ftab%3Dtools",
	);
});

test("getAuthorizationResumePath rebuilds the authorize URL when oauth params are present", () => {
	const search = new URLSearchParams({
		client_id: "abc",
		redirect_uri: "http://localhost:6274/oauth/callback/debug",
		response_type: "code",
		state: "xyz",
		scope: "openid profile",
	});

	assert.equal(
		getAuthorizationResumePath(search),
		"/api/auth/oauth2/authorize?client_id=abc&redirect_uri=http%3A%2F%2Flocalhost%3A6274%2Foauth%2Fcallback%2Fdebug&response_type=code&state=xyz&scope=openid+profile",
	);
});

test("getAuthorizationResumePath falls back to app return target when oauth params are absent", () => {
	const search = new URLSearchParams({
		returnTo: "/settings",
	});

	assert.equal(getAuthorizationResumePath(search), "/settings");
	assert.equal(getAuthorizationResumePath(new URLSearchParams()), null);
});
