import { authClient } from "#/lib/auth-client";

export default function BetterAuthHeader() {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return (
			<div className="h-8 w-24 animate-pulse rounded-md bg-[var(--border)]" />
		);
	}

	if (!session?.user) {
		return (
			<a
				href="/sign-in"
				className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--accent)] px-3.5 text-sm font-medium !text-white transition-opacity hover:opacity-90"
			>
				Sign in
			</a>
		);
	}

	const label =
		session.user.name ?? session.user.email ?? session.user.id ?? "User";
	const initial = label.charAt(0).toUpperCase();

	return (
		<div className="flex items-center gap-3">
			<div className="hidden items-center gap-2.5 sm:flex">
				{session.user.image ? (
					<img
						src={session.user.image}
						alt=""
						className="h-7 w-7 rounded-full border border-[var(--border)]"
					/>
				) : (
					<div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]">
						<span className="text-[11px] font-medium text-[var(--ink-muted)]">
							{initial}
						</span>
					</div>
				)}
				<span className="text-sm text-[var(--ink-muted)]">{label}</span>
			</div>
			<button
				type="button"
				onClick={() => {
					void authClient.signOut();
				}}
				className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--bg)]"
			>
				Sign out
			</button>
		</div>
	);
}
