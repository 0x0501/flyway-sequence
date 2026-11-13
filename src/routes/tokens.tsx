import { createFileRoute, redirect } from "@tanstack/react-router";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { bearerInstallSnippets } from "#/lib/bearer-install.ts";
import { getErrorMessage } from "#/lib/error-message.ts";
import { personalTokenLifetimes } from "#/lib/personal-token-policy.ts";
import { buildSignInRoute } from "#/lib/sign-in-flow.ts";
import { ensurePoolAccess } from "#/server/access.ts";
import {
	getPersonalTokens,
	issuePersonalToken,
	revokeToken,
} from "#/server/personal-tokens.ts";

export const Route = createFileRoute("/tokens")({
	beforeLoad: async () => {
		const { authorized } = await ensurePoolAccess();
		if (!authorized) throw redirect({ href: buildSignInRoute("/tokens") });
	},
	component: Tokens,
});

type TokenMetadata = Awaited<ReturnType<typeof getPersonalTokens>>[number];

const inputClass =
	"mt-2 min-h-11 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
const buttonClass =
	"min-h-11 rounded-md border border-[var(--border-strong)] px-4 text-sm font-medium transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50";

function formatDate(date: Date) {
	return new Date(date).toLocaleString();
}

function Tokens() {
	const [tokens, setTokens] = useState<TokenMetadata[]>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [created, setCreated] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [confirmId, setConfirmId] = useState<string | null>(null);
	const [revokingId, setRevokingId] = useState<string | null>(null);
	const load = useCallback(async () => {
		const records = await getPersonalTokens();
		setTokens(records);
	}, []);

	useEffect(() => {
		void load()
			.catch((error) =>
				setError(
					getErrorMessage(error, "Could not load tokens. Reload to retry."),
				),
			)
			.finally(() => setLoading(false));
	}, [load]);

	async function create(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const values = new FormData(form);
		setSubmitting(true);
		setError(null);
		try {
			const result = await issuePersonalToken({
				data: {
					name: String(values.get("name")),
					expiresInDays: Number(
						values.get("expiresInDays"),
					) as (typeof personalTokenLifetimes)[number],
				},
			});
			setCreated(result.token);
			setCopied(false);
			setTokens((records) => [result.metadata, ...records]);
			form.reset();
		} catch (error) {
			setError(getErrorMessage(error, "Could not create token. Try again."));
		} finally {
			setSubmitting(false);
		}
	}

	async function revoke(tokenId: string) {
		setRevokingId(tokenId);
		setError(null);
		try {
			await revokeToken({ data: { tokenId } });
			setTokens((records) =>
				records.map((record) =>
					record.id === tokenId ? { ...record, revokedAt: new Date() } : record,
				),
			);
			setConfirmId(null);
		} catch (error) {
			setError(getErrorMessage(error, "Could not revoke token. Try again."));
		} finally {
			setRevokingId(null);
		}
	}

	async function copyToken() {
		if (!created) return;
		try {
			await navigator.clipboard.writeText(created);
			setCopied(true);
		} catch {
			setError("Could not copy token. Select and copy the token manually.");
		}
	}

	return (
		<div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
			<h1 className="text-3xl font-semibold tracking-tight">Personal tokens</h1>
			<p className="mt-3 max-w-prose leading-relaxed text-[var(--ink-muted)]">
				Connect your MCP client with Bearer authentication. Each token belongs
				to your account and can allocate or roll back Flyway versions.
				Organization membership is still required.
			</p>
			{error ? (
				<p role="alert" className="mt-6 text-sm text-[var(--danger)]">
					{error}
				</p>
			) : null}
			{created ? (
				<section
					aria-labelledby="created-token-title"
					className="mt-8 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-6"
				>
					<h2 id="created-token-title" className="text-lg font-semibold">
						Save your token now
					</h2>
					<p role="status" className="mt-2 text-sm text-[var(--ink-muted)]">
						Token created. This is the only time the full token is shown. Store
						it securely and keep it out of shared configuration files.
					</p>
					<label
						htmlFor="created-token"
						className="mt-4 block text-sm font-medium"
					>
						Bearer token
					</label>
					<textarea
						id="created-token"
						readOnly
						value={created}
						rows={3}
						spellCheck={false}
						className={`${inputClass} break-all font-mono text-sm`}
						onFocus={(event) => event.currentTarget.select()}
					/>
					<div className="mt-4 flex flex-wrap gap-3">
						<button
							type="button"
							onClick={() => void copyToken()}
							className={buttonClass}
						>
							{copied ? "Copied" : "Copy token"}
						</button>
						<button
							type="button"
							onClick={() => setCreated(null)}
							className={buttonClass}
						>
							I've saved my token
						</button>
					</div>
				</section>
			) : (
				<form
					onSubmit={(event) => void create(event)}
					className="mt-8 space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 md:p-8"
				>
					<label htmlFor="token-name" className="block text-sm font-medium">
						Token name
						<input
							id="token-name"
							name="name"
							className={inputClass}
							placeholder="Work laptop"
							required
							maxLength={100}
							autoComplete="off"
						/>
					</label>
					<label htmlFor="token-lifetime" className="block text-sm font-medium">
						Expires in
						<select
							id="token-lifetime"
							name="expiresInDays"
							defaultValue="90"
							className={inputClass}
						>
							{personalTokenLifetimes.map((days) => (
								<option key={days} value={days}>
									{days} days
								</option>
							))}
						</select>
					</label>
					<button
						type="submit"
						disabled={submitting}
						className={`${buttonClass} border-transparent bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90 hover:bg-[var(--accent)]`}
					>
						{submitting ? "Creating..." : "Create token"}
					</button>
				</form>
			)}
			<section aria-labelledby="your-tokens-title" className="mt-12">
				<h2 id="your-tokens-title" className="text-xl font-semibold">
					Your tokens
				</h2>
				<p className="mt-2 text-sm text-[var(--ink-muted)]">
					Revoking a token blocks subsequent requests immediately. Expired and
					revoked tokens stay here for reference.
				</p>
				{loading ? (
					<p role="status" className="mt-4 text-sm text-[var(--ink-muted)]">
						Loading tokens...
					</p>
				) : tokens.length === 0 ? (
					<p className="mt-4 text-sm text-[var(--ink-muted)]">
						No tokens yet. Create one for each device or integration.
					</p>
				) : (
					<ul className="mt-4 divide-y divide-[var(--border)]">
						{tokens.map((token) => {
							const status = token.revokedAt
								? "Revoked"
								: new Date(token.expiresAt).getTime() <= Date.now()
									? "Expired"
									: "Active";
							return (
								<li
									key={token.id}
									className="flex flex-wrap items-start justify-between gap-4 py-5"
								>
									<div className="min-w-0">
										<p className="break-words font-medium">
											{token.name}{" "}
											<span className="ml-2 text-sm font-normal text-[var(--ink-muted)]">
												{status}
											</span>
										</p>
										<p className="mt-2 font-mono text-sm text-[var(--ink-muted)]">
											{token.tokenPrefix}…
										</p>
										<p className="mt-2 text-sm text-[var(--ink-muted)]">
											Created {formatDate(token.createdAt)} · Expires{" "}
											{formatDate(token.expiresAt)}
										</p>
										<p className="mt-1 text-sm text-[var(--ink-muted)]">
											Last used:{" "}
											{token.lastUsedAt
												? formatDate(token.lastUsedAt)
												: "Never"}
										</p>
									</div>
									{status === "Active" ? (
										<div className="flex flex-wrap items-center gap-2">
											{confirmId === token.id ? (
												<>
													<button
														type="button"
														disabled={revokingId !== null}
														onClick={() => void revoke(token.id)}
														className={`${buttonClass} text-[var(--danger)]`}
													>
														{revokingId === token.id
															? "Revoking..."
															: "Confirm revoke"}
													</button>
													<button
														type="button"
														disabled={revokingId !== null}
														onClick={() => setConfirmId(null)}
														className={buttonClass}
													>
														Cancel
													</button>
												</>
											) : (
												<button
													type="button"
													aria-label={`Revoke ${token.name}`}
													onClick={() => setConfirmId(token.id)}
													className={`${buttonClass} text-[var(--danger)]`}
												>
													Revoke
												</button>
											)}
										</div>
									) : null}
								</li>
							);
						})}
					</ul>
				)}
			</section>
			<section aria-labelledby="bearer-setup-title" className="mt-12">
				<h2 id="bearer-setup-title" className="text-xl font-semibold">
					Connect with Bearer auth
				</h2>
				<p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
					Replace YOUR_PERSONAL_TOKEN with your saved token. Bearer auth needs
					no client registration or OAuth login. If this server is already
					configured with OAuth, remove that client configuration before adding
					it again. For Codex, make the environment variable available whenever
					you launch the client.
				</p>
				{Object.entries(bearerInstallSnippets).map(([target, snippet]) => (
					<div key={target} className="mt-6">
						<h3 className="text-sm font-medium">
							{target === "codex" ? "Codex" : "Claude Code"}
						</h3>
						<pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 font-mono text-sm leading-6">
							<code>{snippet}</code>
						</pre>
					</div>
				))}
			</section>
		</div>
	);
}
