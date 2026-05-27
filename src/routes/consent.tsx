import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { authClient } from "#/lib/auth-client.ts";
import { getErrorMessage } from "#/lib/error-message.ts";

export const Route = createFileRoute("/consent")({
	component: ConsentRoute,
});

function ConsentRoute() {
	return (
		<div className="px-6 py-16 md:py-24">
			<div className="mx-auto flex w-full max-w-2xl flex-col">
				<ClientOnly fallback={<ConsentShell state="loading" />}>
					<ConsentPanel />
				</ClientOnly>
			</div>
		</div>
	);
}

function ConsentPanel() {
	const { data: session, isPending } = authClient.useSession();
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const signInHref = useMemo(() => `/sign-in${window.location.search}`, []);

	const scopes = useMemo(() => {
		const params = new URLSearchParams(window.location.search);
		const scope = params.get("scope") ?? "";
		return scope.split(" ").filter(Boolean);
	}, []);

	useEffect(() => {
		if (!session) {
			return;
		}
		setError(null);
	}, [session]);

	async function handleConsent(accept: boolean) {
		setError(null);
		setIsSubmitting(true);

		try {
			await authClient.oauth2.consent(
				{ accept },
				{
					onError(ctx) {
						setError(
							getErrorMessage(
								ctx.error,
								"Authorization could not be completed.",
							),
						);
					},
				},
			);
		} catch (consentError) {
			setError(
				getErrorMessage(consentError, "Authorization could not be completed."),
			);
		} finally {
			setIsSubmitting(false);
		}
	}

	if (isPending) {
		return <ConsentShell state="loading" />;
	}

	if (!session) {
		return (
			<div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8 md:p-10">
				<p className="text-xs font-medium text-[var(--warning-ink)]">
					Sign-in needed
				</p>
				<h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)] md:text-[1.75rem]">
					Authorize after you sign in
				</h1>
				<p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-muted)]">
					This authorization request can only continue once you have signed in
					with a GitHub account that belongs to the approved organization.
				</p>
				<div className="mt-7 flex justify-end">
					<a
						className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-ink)] transition-opacity hover:opacity-90"
						href={signInHref}
					>
						Go to sign in
					</a>
				</div>
			</div>
		);
	}

	const identity =
		session.user?.name ?? session.user?.email ?? session.user?.id;

	return (
		<div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8 md:p-10">
			<div className="space-y-2">
				<p className="text-xs font-medium text-[var(--accent)]">
					Authorization
				</p>
				<h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] md:text-[1.75rem]">
					Grant MCP access
				</h1>
				<p className="text-[15px] leading-relaxed text-[var(--ink-muted)]">
					Signed in as{" "}
					<span className="font-medium text-[var(--ink)]">{identity}</span>. A
					client is asking to call your MCP tools.
				</p>
			</div>

			<div className="my-7 h-px bg-[var(--border)]" />

			<div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5">
				<p className="text-[13px] font-medium text-[var(--ink-muted)]">
					Requested scopes
				</p>
				<div className="mt-3 flex flex-wrap gap-2">
					{scopes.length > 0 ? (
						scopes.map((scope) => (
							<span
								key={scope}
								className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 font-mono text-[12px] text-[var(--ink)]"
							>
								{scope}
							</span>
						))
					) : (
						<span className="text-sm text-[var(--ink-subtle)]">
							No explicit scopes requested.
						</span>
					)}
				</div>
			</div>

			{error ? (
				<div className="mt-5 rounded-xl border border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--danger)]">
					<p className="font-medium text-[var(--ink)]">Authorization failed</p>
					<p className="mt-0.5">{error}</p>
				</div>
			) : null}

			<div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
				<button
					type="button"
					disabled={isSubmitting}
					className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--bg)] disabled:opacity-50"
					onClick={() => {
						void handleConsent(false);
					}}
				>
					Deny
				</button>
				<button
					type="button"
					disabled={isSubmitting}
					className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-50"
					onClick={() => {
						void handleConsent(true);
					}}
				>
					{isSubmitting ? "Authorizing..." : "Authorize access"}
				</button>
			</div>
		</div>
	);
}

function ConsentShell({ state: _state }: { state: "loading" }) {
	return (
		<div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8 md:p-10">
			<p className="text-xs font-medium text-[var(--accent)]">Authorization</p>
			<h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)] md:text-[1.75rem]">
				Grant MCP access
			</h1>
			<p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-muted)]">
				Loading the authorization request.
			</p>
			<div className="my-7 h-px bg-[var(--border)]" />
			<div className="space-y-2">
				<div className="h-4 w-32 animate-pulse rounded bg-[var(--border)]" />
				<div className="h-7 w-full animate-pulse rounded bg-[var(--border)]" />
			</div>
			<div className="mt-7 flex justify-end gap-3">
				<div className="h-11 w-20 animate-pulse rounded-md bg-[var(--border)]" />
				<div className="h-11 w-40 animate-pulse rounded-md bg-[var(--border)]" />
			</div>
		</div>
	);
}
