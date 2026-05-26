import assert from "node:assert/strict";
import test from "node:test";

import { parseGithubMembershipResponse } from "../../server/github-membership.ts";

test("parseGithubMembershipResponse returns true for active membership", async () => {
	const response = new Response(
		JSON.stringify({
			url: "https://api.github.com/user/memberships/orgs/zdhl-amazing",
			state: "active",
			role: "member",
			organization_url: "https://api.github.com/orgs/zdhl-amazing",
			organization: {
				login: "zdhl-amazing",
				id: 1,
				node_id: "O_1",
				url: "https://api.github.com/orgs/zdhl-amazing",
				repos_url: "https://api.github.com/orgs/zdhl-amazing/repos",
				events_url: "https://api.github.com/orgs/zdhl-amazing/events",
				hooks_url: "https://api.github.com/orgs/zdhl-amazing/hooks",
				issues_url: "https://api.github.com/orgs/zdhl-amazing/issues",
				members_url:
					"https://api.github.com/orgs/zdhl-amazing/members{/member}",
				public_members_url:
					"https://api.github.com/orgs/zdhl-amazing/public_members{/member}",
				avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
				description: null,
			},
			user: null,
		}),
		{
			status: 200,
			headers: {
				"content-type": "application/json",
			},
		},
	);

	const isMember = await parseGithubMembershipResponse(response);

	assert.equal(isMember, true);
});
