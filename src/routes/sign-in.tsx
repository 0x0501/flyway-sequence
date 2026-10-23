import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { authClient } from "#/lib/auth-client.ts";
import { getErrorMessage } from "#/lib/error-message.ts";
import { getAuthorizationResumePath } from "#/lib/sign-in-flow.ts";

export const Route = createFileRoute("/sign-in")({
	component: SignInRoute,
});

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
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const nextHref = useMemo(
		() =>
			getAuthorizationResumePath(new URLSearchParams(window.location.search)) ??
			"/pool",
		[],
	);

	async function handleSignIn() {
		setError(null);
		setIsSubmitting(true);
		try {
			const result = await authClient.signIn.social({
				provider: "github",
				callbackURL: window.location.href,
			});
			if (result.error)
				setError(getErrorMessage(result.error, "GitHub sign-in failed."));
		} catch (error) {
			setError(getErrorMessage(error, "GitHub sign-in failed."));
		} finally {
			setIsSubmitting(false);
		}
	}

	if (isPending) return <SignInShell state="loading" />;
	const identity = session?.user.name ?? session?.user.email;

	return (
		<div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8 md:p-10">
			<div className="space-y-2">
				<p className="text-xs font-medium text-[var(--accent)]">Sign in</p>
				<h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] md:text-[1.75rem]">
					Continue with GitHub
				</h1>
				<p className="text-[15px] leading-relaxed text-[var(--ink-muted)]">
					Access is available to members of the approved GitHub organization.
				</p>
			</div>
			<div className="my-7 h-px bg-[var(--border)]" />
			<p className="text-sm text-[var(--ink-muted)]">
				{session
					? `Signed in as ${identity}.`
					: "Sign in to authorize an MCP client or view the sequence pool."}
			</p>
			{error ? (
				<p className="mt-4 text-sm text-[var(--danger)]">{error}</p>
			) : null}
			<div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
				{session ? (
					<>
						<button
							type="button"
							className="text-sm text-[var(--ink-muted)]"
							onClick={() => void authClient.signOut()}
						>
							Use another account
						</button>
						<a
							href={nextHref}
							className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-ink)] transition-opacity hover:opacity-90"
						>
							Continue
						</a>
					</>
				) : (
					<button
						type="button"
						disabled={isSubmitting}
						onClick={() => void handleSignIn()}
						className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-50"
					>
						{isSubmitting ? "Signing in..." : "Sign in with GitHub"}
					</button>
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
					Continue with GitHub
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
