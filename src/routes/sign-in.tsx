import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { authClient } from "#/lib/auth-client.ts";
import {
	getAuthorizationResumePath,
	isAuthorizationRequest,
} from "#/lib/sign-in-flow.ts";

export const Route = createFileRoute("/sign-in")({
	component: SignInRoute,
});

type OrgCheckState = "idle" | "checking" | "authorized" | "denied";

function SignInRoute() {
	return (
		<div className="px-6 py-16 md:py-24">
			<div className="mx-auto flex w-full max-w-xl flex-col">
				<ClientOnly fallback={<SignInShell state="idle" />}>
					<SignInPanel />
				</ClientOnly>
			</div>
		</div>
	);
}

function SignInPanel() {
	const { data: session, isPending } = authClient.useSession();
	const [orgCheckState, setOrgCheckState] = useState<OrgCheckState>("idle");
	const [error, setError] = useState<string | null>(null);

	const searchParams = useMemo(
		() => new URLSearchParams(window.location.search),
		[],
	);
	const nextHref = useMemo(
		() => getAuthorizationResumePath(searchParams),
		[searchParams],
	);

	async function handleSignIn() {
		await authClient.signIn.social({
			provider: "github",
			callbackURL: window.location.href,
			scopes: ["user:email", "read:org"],
		});
	}

	useEffect(() => {
		if (!session) {
			setOrgCheckState("idle");
			setError(null);
			return;
		}

		let isMounted = true;

		async function verifyMembership() {
			setOrgCheckState("checking");
			setError(null);

			const response = await fetch("/api/auth/github-org-access", {
				credentials: "include",
			});
			const data = (await response.json()) as {
				authorized?: boolean;
				message?: string;
			};

			if (!isMounted) {
				return;
			}

			if (response.ok && data.authorized) {
				setOrgCheckState("authorized");
				return;
			}

			setOrgCheckState("denied");
			setError(
				data.message ??
					"Only approved GitHub organization members can sign in.",
			);
			await authClient.signOut();
		}

		void verifyMembership();

		return () => {
			isMounted = false;
		};
	}, [session]);

	useEffect(() => {
		if (orgCheckState !== "authorized") {
			return;
		}
		if (isAuthorizationRequest(searchParams)) {
			return;
		}
		window.location.href = searchParams.get("returnTo") ?? "/pool";
	}, [orgCheckState, searchParams]);

	if (isPending) {
		return <SignInShell state="loading" />;
	}

	const identity =
		session?.user?.name ?? session?.user?.email ?? session?.user?.id;

	return (
		<div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8 md:p-10">
			<div className="space-y-2">
				<p className="text-xs font-medium text-[var(--accent)]">Sign in</p>
				<h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] md:text-[1.75rem]">
					Verify your GitHub org membership
				</h1>
				<p className="text-[15px] leading-relaxed text-[var(--ink-muted)]">
					Tokens issue only to members of the approved organization. We re-check
					membership on every sign-in.
				</p>
			</div>

			<div className="my-7 h-px bg-[var(--border)]" />

			{!session ? (
				<Status
					tone="muted"
					title="Read-only org permission requested"
					body="We ask for read:org so we can verify your membership and nothing more."
				/>
			) : null}

			{session && orgCheckState === "checking" ? (
				<Status
					tone="muted"
					title={`Checking @${identity}`}
					body="Looking up your membership in the approved organization."
				/>
			) : null}

			{session && orgCheckState === "authorized" ? (
				<Status
					tone="success"
					title={`Approved as ${identity}`}
					body="You can continue to the authorization step."
				/>
			) : null}

			{session && orgCheckState === "denied" ? (
				<Status
					tone="danger"
					title="Not an organization member"
					body={
						error ?? "Only approved GitHub organization members can sign in."
					}
				/>
			) : null}

			<div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
				{session &&
				orgCheckState === "authorized" &&
				isAuthorizationRequest(searchParams) &&
				nextHref ? (
					<a
						className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-ink)] transition-opacity hover:opacity-90 sm:w-auto"
						href={nextHref}
					>
						Continue
					</a>
				) : (
					!session && (
						<button
							type="button"
							disabled={orgCheckState === "checking"}
							className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-50"
							onClick={() => {
								void handleSignIn();
							}}
						>
							{session && orgCheckState === "denied"
								? "Try another GitHub account"
								: "Sign in with GitHub"}
						</button>
					)
				)}
			</div>
		</div>
	);
}

function SignInShell({ state }: { state: "idle" | "loading" }) {
	return (
		<div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8 md:p-10">
			<div className="space-y-2">
				<p className="text-xs font-medium text-[var(--accent)]">Sign in</p>
				<h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] md:text-[1.75rem]">
					Verify your GitHub org membership
				</h1>
				<p className="text-[15px] leading-relaxed text-[var(--ink-muted)]">
					{state === "loading"
						? "Restoring your session."
						: "Preparing the sign-in flow."}
				</p>
			</div>
			<div className="my-7 h-px bg-[var(--border)]" />
			<div className="mt-7 flex justify-end">
				<div className="h-11 w-44 animate-pulse rounded-md bg-[var(--border)]" />
			</div>
		</div>
	);
}

function Status({
	tone,
	title,
	body,
}: {
	tone: "muted" | "success" | "danger";
	title: string;
	body: string;
}) {
	const toneClasses: Record<typeof tone, string> = {
		muted: "border-[var(--border)] bg-[var(--bg)] text-[var(--ink-muted)]",
		success:
			"border-[color:color-mix(in_oklab,var(--accent)_30%,transparent)] bg-[var(--accent-soft)] text-[var(--accent)]",
		danger:
			"border-[color:color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[var(--danger-soft)] text-[var(--danger)]",
	};
	return (
		<div
			className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${toneClasses[tone]}`}
		>
			<p className="font-medium text-[var(--ink)]">{title}</p>
			<p className="mt-0.5">{body}</p>
		</div>
	);
}
