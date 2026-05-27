import assert from "node:assert/strict";
import test from "node:test";

import {
	type GithubOrgAccessDependencies,
	verifyGithubOrgAccess,
} from "../../server/mcp-access.ts";

function createDependencies(
	overrides: Partial<GithubOrgAccessDependencies> = {},
): GithubOrgAccessDependencies {
	return {
		getSession: async () => ({
			user: {
				id: "user_123",
				email: "member@example.com",
				name: "Org Member",
			},
			session: {
				id: "session_123",
			},
		}),
		getGithubAccessToken: async () => "github-token",
		checkOrgMember: async () => true,
		organization: "acme",
		...overrides,
	};
}

test("verifyGithubOrgAccess returns unauthorized when session is missing", async () => {
	const result = await verifyGithubOrgAccess(
		createDependencies({
			getSession: async () => null,
		}),
	);

	assert.deepEqual(result, {
		ok: false,
		status: 401,
		code: "UNAUTHENTICATED",
		message: "Please sign in before authorizing MCP access.",
	});
});

test("verifyGithubOrgAccess returns forbidden when GitHub token is missing", async () => {
	const result = await verifyGithubOrgAccess(
		createDependencies({
			getGithubAccessToken: async () => undefined,
		}),
	);

	assert.deepEqual(result, {
		ok: false,
		status: 403,
		code: "MISSING_GITHUB_ACCESS_TOKEN",
		message:
			"GitHub organization access could not be verified for this account.",
	});
});

test("verifyGithubOrgAccess returns forbidden when user is outside the org", async () => {
	const result = await verifyGithubOrgAccess(
		createDependencies({
			checkOrgMember: async () => false,
		}),
	);

	assert.deepEqual(result, {
		ok: false,
		status: 403,
		code: "NOT_ORG_MEMBER",
		message: "Only GitHub organization members can authorize MCP access.",
	});
});

test("verifyGithubOrgAccess returns success for organization members", async () => {
	const result = await verifyGithubOrgAccess(createDependencies());

	assert.equal(result.ok, true);

	if (!result.ok) {
		throw new Error("expected an authorized result");
	}

	assert.equal(result.githubAccessToken, "github-token");
	assert.equal(result.session.user.id, "user_123");
});
