import { expect, test } from "vitest";

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

	expect(result).toEqual({
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

	expect(result).toEqual({
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

	expect(result).toEqual({
		ok: false,
		status: 403,
		code: "NOT_ORG_MEMBER",
		message: "Only GitHub organization members can authorize MCP access.",
	});
});

test("verifyGithubOrgAccess returns success for organization members", async () => {
	const result = await verifyGithubOrgAccess(createDependencies());

	expect(result.ok).toBe(true);

	if (!result.ok) {
		throw new Error("expected an authorized result");
	}

	expect(result.githubAccessToken).toBe("github-token");
	expect(result.session.user.id).toBe("user_123");
});
