import { createFileRoute, redirect } from "@tanstack/react-router";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { authClient } from "#/lib/auth-client.ts";
import { getErrorMessage } from "#/lib/error-message.ts";
import { buildSignInRoute } from "#/lib/sign-in-flow.ts";
import { ensurePoolAccess } from "#/server/access.ts";

export const Route = createFileRoute("/clients")({
	beforeLoad: async () => {
		const { authorized } = await ensurePoolAccess();
		if (!authorized) throw redirect({ href: buildSignInRoute("/clients") });
	},
	component: Clients,
});

type RegisteredClient = {
	client_id: string;
	client_name?: string | null;
	redirect_uris: string[];
};
const inputClass =
	"mt-2 min-h-11 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2 text-base text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

function Clients() {
	const [clients, setClients] = useState<RegisteredClient[]>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [createdId, setCreatedId] = useState<string | null>(null);
	const load = useCallback(async () => {
		try {
			const result = await authClient.oauth2.getClients();
			if (result.error) throw result.error;
			setClients(result.data ?? []);
		} catch (error) {
			setError(getErrorMessage(error, "Could not load clients."));
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		void load();
	}, [load]);

	async function register(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const values = new FormData(form);
		setSubmitting(true);
		setError(null);
		setCreatedId(null);
		try {
			const applicationType =
				values.get("applicationType") === "web" ? "web" : "native";
			const result = await authClient.oauth2.createClient({
				client_name: String(values.get("name")).trim(),
				redirect_uris: String(values.get("redirectUris"))
					.split(/\r?\n/)
					.map((uri) => uri.trim())
					.filter(Boolean),
				application_type: applicationType,
				token_endpoint_auth_method: "none",
				grant_types: ["authorization_code", "refresh_token"],
				response_types: ["code"],
				scope: "openid profile email offline_access mcp:write",
			});
			if (result.error) throw result.error;
			setCreatedId(result.data.client_id);
			form.reset();
			await load();
		} catch (error) {
			setError(getErrorMessage(error, "Client registration failed."));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
			<p className="text-xs font-medium text-[var(--accent)]">Clients</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight">
				Register an MCP client
			</h1>
			<p className="mt-3 text-base leading-relaxed text-[var(--ink-muted)]">
				Register each application once, then configure its client ID in that
				application. Users sign in and authorize access with their own GitHub
				accounts.
			</p>
			<form
				onSubmit={(event) => void register(event)}
				className="mt-8 space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 md:p-8"
			>
				<label className="block text-sm font-medium" htmlFor="client-name">
					Application name
					<input
						className={inputClass}
						id="client-name"
						name="name"
						required
						maxLength={100}
						autoComplete="off"
					/>
				</label>
				<label className="block text-sm font-medium" htmlFor="client-type">
					Application type
					<select
						className={inputClass}
						id="client-type"
						name="applicationType"
						defaultValue="native"
					>
						<option value="native">Native / desktop / CLI</option>
						<option value="web">Web application</option>
					</select>
				</label>
				<label className="block text-sm font-medium" htmlFor="client-redirects">
					Redirect URIs
					<textarea
						className={`${inputClass} font-mono`}
						id="client-redirects"
						name="redirectUris"
						rows={3}
						required
						aria-describedby="redirect-help"
						placeholder="http://127.0.0.1:1455/auth/callback"
					/>
				</label>
				<p
					id="redirect-help"
					className="text-sm leading-relaxed text-[var(--ink-muted)]"
				>
					One exact callback URI per line, supplied by the client application.
					Web callbacks use HTTPS. These public clients use PKCE and do not need
					a client secret.
				</p>
				{error ? (
					<p role="alert" className="text-sm text-[var(--danger)]">
						{error}
					</p>
				) : null}
				{createdId ? (
					<div
						role="status"
						className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4"
					>
						<p className="text-sm font-medium">Client registered</p>
						<p className="mt-2 break-all font-mono text-sm select-all">
							{createdId}
						</p>
					</div>
				) : null}
				<button
					type="submit"
					disabled={submitting}
					className="min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-ink)] disabled:opacity-50"
				>
					{submitting ? "Registering..." : "Register client"}
				</button>
			</form>
			<h2 className="mt-12 text-xl font-semibold">Your registered clients</h2>
			{loading ? (
				<p role="status" className="mt-4 text-sm text-[var(--ink-muted)]">
					Loading clients...
				</p>
			) : clients.length === 0 ? (
				<p className="mt-4 text-sm text-[var(--ink-muted)]">
					No clients registered yet.
				</p>
			) : (
				<ul className="mt-4 divide-y divide-[var(--border)]">
					{clients.map((client) => (
						<li key={client.client_id} className="py-5">
							<p className="font-medium">
								{client.client_name ?? "MCP client"}
							</p>
							<p className="mt-2 select-all break-all font-mono text-sm text-[var(--ink-muted)]">
								{client.client_id}
							</p>
							<p className="mt-2 break-all text-sm text-[var(--ink-muted)]">
								{client.redirect_uris.join(", ")}
							</p>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
