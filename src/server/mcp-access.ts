import type { Auth } from "better-auth/types";
import { checkGithubOrgMember } from "./github.ts";

export type AuthorizedSession = {
	user: {
		id: string;
		email?: string | null;
		name?: string | null;
		image?: string | null;
	};
	session?: {
		id?: string;
	};
};

export type GithubOrgAccessDependencies = {
	getSession: () => Promise<AuthorizedSession | null>;
	getGithubAccessToken: () => Promise<string | null | undefined>;
	checkOrgMember: (
		accessToken: string,
		organization: string,
	) => Promise<boolean>;
	organization: string;
};

export type GithubOrgAccessResult =
	| {
			ok: true;
			session: AuthorizedSession;
			githubAccessToken: string;
	  }
	| {
			ok: false;
			status: 401 | 403;
			code:
				| "UNAUTHENTICATED"
				| "MISSING_GITHUB_ACCESS_TOKEN"
				| "NOT_ORG_MEMBER";
			message: string;
	  };

export async function verifyGithubOrgAccess(
	dependencies: GithubOrgAccessDependencies,
): Promise<GithubOrgAccessResult> {
	const session = await dependencies.getSession();

	if (!session) {
		return {
			ok: false,
			status: 401,
			code: "UNAUTHENTICATED",
			message: "Please sign in before authorizing MCP access.",
		};
	}

	const githubAccessToken = await dependencies.getGithubAccessToken();

	if (!githubAccessToken) {
		return {
			ok: false,
			status: 403,
			code: "MISSING_GITHUB_ACCESS_TOKEN",
			message:
				"GitHub organization access could not be verified for this account.",
		};
	}

	const isOrgMember = await dependencies.checkOrgMember(
		githubAccessToken,
		dependencies.organization,
	);

	if (!isOrgMember) {
		return {
			ok: false,
			status: 403,
			code: "NOT_ORG_MEMBER",
			message: "Only GitHub organization members can authorize MCP access.",
		};
	}

	return {
		ok: true,
		session,
		githubAccessToken,
	};
}

export async function verifyGithubOrgAccessForHeaders(
	auth: Auth,
	headers: Headers,
	organization: string,
): Promise<GithubOrgAccessResult> {
	return verifyGithubOrgAccess({
		getSession: async () =>
			(await auth.api.getSession({
				headers,
			})) as AuthorizedSession | null,
		getGithubAccessToken: async () => {
			const token = await auth.api.getAccessToken({
				body: {
					providerId: "github",
				},
				headers,
			});

			return token.accessToken;
		},
		checkOrgMember: checkGithubOrgMember,
		organization,
	});
}
