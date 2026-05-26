import { z } from "zod";

export async function parseGithubMembershipResponse(res: Response) {
	const responseText = await res.text();

	let responseData: unknown;
	try {
		responseData = responseText ? JSON.parse(responseText) : null;
	} catch {
		responseData = responseText;
	}

	if (res.status === 401) {
		throw new Error("GitHub token invalid");
	}

	if (res.status === 403) {
		console.error("GitHub 403 detail:", {
			body: responseData,
			xOAuthScopes: res.headers.get("x-oauth-scopes"),
			xAcceptedOAuthScopes: res.headers.get("x-accepted-oauth-scopes"),
			xGitHubSSO: res.headers.get("x-github-sso"),
			xRateLimitRemaining: res.headers.get("x-ratelimit-remaining"),
			xRateLimitReset: res.headers.get("x-ratelimit-reset"),
		});

		throw new Error(
			`GitHub token permission denied: ${
				typeof responseData === "object" &&
				responseData &&
				"message" in responseData
					? String(responseData.message)
					: responseText
			}`,
		);
	}

	if (res.status === 404) {
		return false;
	}

	if (!res.ok) {
		throw new Error(`GitHub org check failed: ${res.status}`);
	}

	const data = OrgMembershipSchema.safeParse(responseData);

	if (data.data) {
		return data.data.state === "active";
	}

	throw new Error(
		`Cannot parse response data from github, error: ${data.error}`,
	);
}

export const OrganizationSimpleSchema = z
	.object({
		login: z.string(),
		id: z.number().int(),
		node_id: z.string(),
		url: z.string().url(),
		repos_url: z.string().url(),
		events_url: z.string().url(),
		hooks_url: z.string(),
		issues_url: z.string(),
		members_url: z.string(),
		public_members_url: z.string(),
		avatar_url: z.string(),
		description: z.string().nullable(),
	})
	.loose();

export const SimpleUserSchema = z
	.object({
		name: z.string().nullable().optional(),
		email: z.string().nullable().optional(),
		login: z.string(),
		id: z.number().int(),
		node_id: z.string(),
		avatar_url: z.string().url(),
		gravatar_id: z.string().nullable(),
		url: z.string().url(),
		html_url: z.string().url(),
		followers_url: z.string().url(),
		following_url: z.string(),
		gists_url: z.string(),
		starred_url: z.string(),
		subscriptions_url: z.string().url(),
		organizations_url: z.string().url(),
		repos_url: z.string().url(),
		events_url: z.string(),
		received_events_url: z.string().url(),
		type: z.string(),
		site_admin: z.boolean(),
		starred_at: z.string().optional(),
		user_view_type: z.string().optional(),
	})
	.loose();

export const OrgMembershipSchema = z
	.object({
		url: z.url(),
		state: z.enum(["active", "pending"]),
		role: z.enum(["admin", "member", "billing_manager"]),
		direct_membership: z.boolean().optional(),
		enterprise_teams_providing_indirect_membership: z
			.array(z.string())
			.max(100)
			.optional(),
		organization_url: z.string().url(),
		organization: OrganizationSimpleSchema,
		user: z.union([z.null(), SimpleUserSchema]),
		permissions: z
			.object({
				can_create_repository: z.boolean(),
			})
			.loose()
			.optional(),
	})
	.loose();
