import { parseGithubMembershipResponse } from "./github-membership.ts";

// The org name is not case sensitive
export async function checkGithubOrgMember(accessToken: string, org: string) {
	const res = await fetch(
		`https://api.github.com/user/memberships/orgs/${org}`,
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2026-03-10",
				"User-Agent": "Flyway-Sequence",
			},
		},
	);

	return parseGithubMembershipResponse(res);
}
