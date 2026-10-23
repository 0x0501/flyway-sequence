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

const OrgMembershipSchema = z.object({ state: z.enum(["active", "pending"]) });
