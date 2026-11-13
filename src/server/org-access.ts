import { APIError } from "better-auth/api";
import { and, eq, gt } from "drizzle-orm";
import type { DBClient } from "#/db/client.ts";
import { account, githubOrgMembership } from "#/db/schema/index.ts";
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

	const authorized = await verifyMembership(
		db,
		session.user.id,
		organization,
		async () => {
			const accounts = await auth.api.listUserAccounts({ headers });
			const github = accounts.find(
				(account) => account.providerId === "github",
			);
			if (!github) return null;
			const token = await auth.api.getAccessToken({
				headers,
				body: { accountId: github.id },
			});
			return token.accessToken;
		},
	);
	return authorized
		? { ok: true, session }
		: {
				ok: false,
				status: 403,
				message:
					"Only approved GitHub organization members can access this resource.",
			};
}

export async function verifyUserOrgAccess(
	auth: { api: Pick<AppAuth["api"], "getAccessToken"> },
	db: DBClient,
	userId: string,
	organization: string,
) {
	return verifyMembership(db, userId, organization, async () => {
		const [github] = await db
			.select({ id: account.id })
			.from(account)
			.where(and(eq(account.userId, userId), eq(account.providerId, "github")))
			.limit(1);
		if (!github) return null;
		try {
			const token = await auth.api.getAccessToken({
				body: { accountId: github.id, userId },
			});
			return token.accessToken;
		} catch (error) {
			if (error instanceof APIError && error.statusCode < 500) return null;
			throw error;
		}
	});
}

async function verifyMembership(
	db: DBClient,
	userId: string,
	organization: string,
	loadAccessToken: () => Promise<string | null>,
) {
	const org = organization.toLowerCase();
	const now = new Date();
	const [cached] = await db
		.select()
		.from(githubOrgMembership)
		.where(
			and(
				eq(githubOrgMembership.userId, userId),
				eq(githubOrgMembership.organization, org),
				gt(githubOrgMembership.expiresAt, now),
			),
		);
	if (cached) return true;

	const accessToken = await loadAccessToken();
	if (!accessToken || !(await checkGithubOrgMember(accessToken, org)))
		return false;

	const expiresAt = new Date(now.getTime() + AUTH_CACHE_SECONDS * 1000);
	await db
		.insert(githubOrgMembership)
		.values({ userId, organization: org, expiresAt })
		.onConflictDoUpdate({
			target: [githubOrgMembership.userId, githubOrgMembership.organization],
			set: { expiresAt },
		});
	return true;
}
