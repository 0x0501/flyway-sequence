import { and, eq, gt } from "drizzle-orm";
import type { DBClient } from "#/db/client.ts";
import { githubOrgMembership } from "#/db/schema/index.ts";
import type { createAuthServer } from "#/lib/auth.ts";
import { AUTH_CACHE_SECONDS } from "#/lib/auth-policy.ts";
import { checkGithubOrgMember } from "./github.ts";

type AppAuth = ReturnType<typeof createAuthServer>;
type Auth = {
	api: Pick<
		AppAuth["api"],
		"getSession" | "listUserAccounts" | "getAccessToken"
	>;
};
type OrgAccessResult =
	| { ok: true; session: AppAuth["$Infer"]["Session"] }
	| { ok: false; status: 401 | 403; message: string };

export async function verifyOrgAccess(
	auth: Auth,
	db: DBClient,
	headers: Headers,
	organization: string,
): Promise<OrgAccessResult> {
	const session = await auth.api.getSession({ headers });
	if (!session)
		return { ok: false, status: 401, message: "Please sign in with GitHub." };

	const org = organization.toLowerCase();
	const now = new Date();
	const [cached] = await db
		.select()
		.from(githubOrgMembership)
		.where(
			and(
				eq(githubOrgMembership.userId, session.user.id),
				eq(githubOrgMembership.organization, org),
				gt(githubOrgMembership.expiresAt, now),
			),
		);
	if (cached) return { ok: true, session };

	const accounts = await auth.api.listUserAccounts({ headers });
	const github = accounts.find((account) => account.providerId === "github");
	if (!github)
		return {
			ok: false,
			status: 403,
			message: "A linked GitHub account is required.",
		};
	const token = await auth.api.getAccessToken({
		headers,
		body: { accountId: github.id },
	});
	if (!(await checkGithubOrgMember(token.accessToken, org))) {
		return {
			ok: false,
			status: 403,
			message:
				"Only approved GitHub organization members can access this resource.",
		};
	}

	const expiresAt = new Date(now.getTime() + AUTH_CACHE_SECONDS * 1000);
	await db
		.insert(githubOrgMembership)
		.values({ userId: session.user.id, organization: org, expiresAt })
		.onConflictDoUpdate({
			target: [githubOrgMembership.userId, githubOrgMembership.organization],
			set: { expiresAt },
		});
	return { ok: true, session };
}
