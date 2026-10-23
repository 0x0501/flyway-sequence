import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { clientEnv } from "#/clientEnv.ts";
import { authClient } from "#/lib/auth-client.ts";
import { buildSignInRoute } from "#/lib/sign-in-flow.ts";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<div>
			<Hero />
			<InstallSection />
			<HowItWorks />
			<Capabilities />
			<ClosingPanel />
		</div>
	);
}

function Hero() {
	return (
		<section className="relative overflow-hidden">
			<div className="mx-auto grid max-w-6xl gap-16 px-6 pt-20 pb-24 md:grid-cols-12 md:gap-10 md:pt-24 md:pb-28">
				<div className="md:col-span-7">
					<p className="text-xs font-medium text-[var(--accent)]">
						Coordinated migration numbering
					</p>
					<h1 className="mt-4 text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[3.5rem] lg:text-[4rem]">
						Sequential Flyway numbers,
						<br className="hidden sm:block" />{" "}
						<span className="text-[var(--ink-muted)]">
							without the merge fights.
						</span>
					</h1>
					<p className="mt-6 max-w-[52ch] text-base leading-relaxed text-[var(--ink-muted)] md:text-[17px]">
						A small server that issues the next Flyway migration number, gated
						by GitHub org and exposed over MCP.
					</p>
					<div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
						<ClientOnly fallback={<HeroCtaSkeleton />}>
							<HeroCta />
						</ClientOnly>
						<a
							href="https://github.com/0x0501/flyway-sequence"
							className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
						>
							View source
							<span aria-hidden className="ml-1.5">
								→
							</span>
						</a>
					</div>
				</div>
				<aside className="relative hidden md:col-span-5 md:block">
					<HeroMascot />
				</aside>
			</div>
		</section>
	);
}

function HeroCta() {
	const { data: session } = authClient.useSession();

	if (session) {
		return (
			<Link
				to="/sign-in"
				className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white! transition-opacity hover:opacity-90"
			>
				Open access
			</Link>
		);
	}

	async function handleLogin() {
		await authClient.signIn.social({
			provider: "github",
			callbackURL: `${window.location.origin}${buildSignInRoute("/")}`,
		});
	}

	return (
		<button
			type="button"
			onClick={() => {
				void handleLogin();
			}}
			className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-ink)] transition-opacity hover:opacity-90"
		>
			Sign in with GitHub
		</button>
	);
}

function HeroCtaSkeleton() {
	return (
		<div className="inline-flex h-11 w-44 animate-pulse rounded-md bg-[var(--border)]" />
	);
}

function HeroMascot() {
	return (
		<div className="ml-auto flex aspect-[655/990] w-full max-w-[320px] items-end justify-center lg:max-w-[320px]">
			<img
				src="/mascot.png"
				alt="Flyway Sequence mascot, a cart"
				className="h-full w-full object-contain"
				loading="eager"
			/>
		</div>
	);
}

type InstallTarget = "claude-code" | "codex";

const INSTALL_SNIPPETS: Record<
	InstallTarget,
	{ tabLabel: string; hint: string; body: string; lang: string }
> = {
	"claude-code": {
		tabLabel: "Claude Code",
		hint: "Register http://localhost:8080/callback as a native client, then replace YOUR_CLIENT_ID",
		lang: "bash",
		body: `claude mcp add --transport http --client-id YOUR_CLIENT_ID --callback-port 8080 \\
  flyway-sequence ${clientEnv.VITE_APP_URL}/api/mcp`,
	},
	codex: {
		tabLabel: "Codex",
		hint: "Register http://127.0.0.1/callback as a native client, then replace YOUR_CLIENT_ID",
		lang: "bash",
		body: `codex mcp add flyway-sequence --url ${clientEnv.VITE_APP_URL}/api/mcp --oauth-client-id YOUR_CLIENT_ID
codex mcp login flyway-sequence --scopes openid,profile,email,offline_access,mcp:write`,
	},
};

function InstallSection() {
	return (
		<section id="install" className="border-t border-[var(--border)]">
			<div className="mx-auto max-w-4xl px-6 py-20 md:py-24">
				<div className="max-w-2xl">
					<h2 className="text-3xl font-semibold tracking-tight text-[var(--ink)] md:text-[2.25rem]">
						Install in your MCP client
					</h2>
					<p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-muted)]">
						Register the application once on the Clients page, then use its
						client ID below. Your client must support MCP 2026-07-28.
					</p>
				</div>

				<ClientOnly fallback={<InstallCardStatic />}>
					<InstallCard />
				</ClientOnly>
			</div>
		</section>
	);
}

function InstallCard() {
	const [target, setTarget] = useState<InstallTarget>("claude-code");
	const [copied, setCopied] = useState(false);

	const snippet = INSTALL_SNIPPETS[target];
	const body = snippet.body;

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(body);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1500);
		} catch {
			// clipboard unavailable; silent
		}
	}

	return (
		<div className="mt-10 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
			<div className="flex items-center border-b border-[var(--border)]">
				<div className="flex">
					{(Object.keys(INSTALL_SNIPPETS) as InstallTarget[]).map((key) => {
						const isActive = key === target;
						return (
							<button
								key={key}
								type="button"
								onClick={() => setTarget(key)}
								className={
									isActive
										? "relative h-12 px-5 text-sm font-medium text-[var(--ink)] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-[var(--accent)]"
										: "h-12 px-5 text-sm font-medium text-[var(--ink-subtle)] transition-colors hover:text-[var(--ink-muted)]"
								}
							>
								{INSTALL_SNIPPETS[key].tabLabel}
							</button>
						);
					})}
				</div>
				<button
					type="button"
					onClick={handleCopy}
					className="ml-auto mr-3 inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-3 font-mono text-[11px] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
				>
					{copied ? "Copied" : "Copy"}
				</button>
			</div>

			<div className="px-5 pt-4 pb-1 font-mono text-[11px] text-[var(--ink-subtle)]">
				{snippet.hint}
			</div>
			<pre className="overflow-x-auto px-5 pb-5 pt-2 font-mono text-[13px] leading-6 text-[var(--ink)]">
				<code>{body}</code>
			</pre>
		</div>
	);
}

function InstallCardStatic() {
	const snippet = INSTALL_SNIPPETS["claude-code"];
	return (
		<div className="mt-10 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
			<div className="flex items-center border-b border-[var(--border)]">
				<div className="flex">
					{(Object.keys(INSTALL_SNIPPETS) as InstallTarget[]).map((key, i) => (
						<span
							key={key}
							className={
								i === 0
									? "relative inline-flex h-12 items-center px-5 text-sm font-medium text-[var(--ink)] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-[var(--accent)]"
									: "inline-flex h-12 items-center px-5 text-sm font-medium text-[var(--ink-subtle)]"
							}
						>
							{INSTALL_SNIPPETS[key].tabLabel}
						</span>
					))}
				</div>
			</div>
			<div className="px-5 pt-4 pb-1 font-mono text-[11px] text-[var(--ink-subtle)]">
				{snippet.hint}
			</div>
			<pre className="overflow-x-auto px-5 pb-5 pt-2 font-mono text-[13px] leading-6 text-[var(--ink)]">
				<code>{snippet.body}</code>
			</pre>
		</div>
	);
}

function HowItWorks() {
	const steps = [
		{
			title: "Authorize once",
			body: "Sign in with GitHub. Membership in the approved organization is verified before any token is issued.",
		},
		{
			title: "Point your client",
			body: "Connect an MCP 2026-07-28 client to the MCP endpoint over OAuth 2.1.",
		},
		{
			title: "Take the next number",
			body: "Call the sequencer tool. The server returns an atomic sequence value for the Shanghai calendar date.",
		},
	];

	return (
		<section id="how" className="border-t border-[var(--border)]">
			<div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
				<div className="grid gap-12 md:grid-cols-3 md:gap-10">
					{steps.map((step) => (
						<div
							key={step.title}
							className="flex flex-col gap-3 border-t border-[var(--ink)] pt-6"
						>
							<h3 className="text-lg font-medium tracking-tight text-[var(--ink)]">
								{step.title}
							</h3>
							<p className="text-[15px] leading-relaxed text-[var(--ink-muted)]">
								{step.body}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

function Capabilities() {
	return (
		<section
			id="what"
			className="border-t border-[var(--border)] bg-[var(--bg-elevated)]/60"
		>
			<div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-12 md:py-24">
				<div className="md:col-span-4">
					<h2 className="text-3xl font-semibold tracking-tight text-[var(--ink)] md:text-[2.25rem]">
						Small surface. Sharp guarantees.
					</h2>
					<p className="mt-4 max-w-[36ch] text-[15px] leading-relaxed text-[var(--ink-muted)]">
						The whole thing is one Cloudflare Worker, one D1 database, and one
						OAuth flow. Read the code in an afternoon.
					</p>
				</div>
				<div className="grid gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] md:col-span-8 md:grid-cols-2">
					<Capability
						title="Atomic counter"
						body="Each call returns a number that has never been returned before. No retries, no off-by-one across branches."
						visual={<AtomicCounterVisual />}
					/>
					<Capability
						title="GitHub org gated"
						body="Tokens issue only to members of an org you control. Successful membership checks are cached for 10 minutes."
					/>
					<Capability
						title="MCP native"
						body="Exposes the sequencer as a Model Context Protocol tool, so registered clients can allocate migration numbers."
						visual={<McpVisual />}
					/>
					<Capability
						title="OAuth 2.1 with PKCE"
						body="Standards-compliant authorization, consent, and token endpoints. No bespoke session glue to maintain."
					/>
				</div>
			</div>
		</section>
	);
}

function Capability({
	title,
	body,
	visual,
}: {
	title: string;
	body: string;
	visual?: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3 bg-[var(--bg)] p-6">
			<h3 className="text-[15px] font-medium text-[var(--ink)]">{title}</h3>
			<p className="text-[14px] leading-relaxed text-[var(--ink-muted)]">
				{body}
			</p>
			{visual ? <div className="mt-2">{visual}</div> : null}
		</div>
	);
}

function AtomicCounterVisual() {
	return (
		<div className="flex items-baseline gap-2 font-mono text-[13px]">
			<span className="text-[var(--ink-subtle)]">V0093</span>
			<span aria-hidden className="text-[var(--ink-subtle)]">
				→
			</span>
			<span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[var(--accent)]">
				V0094
			</span>
		</div>
	);
}

function McpVisual() {
	return (
		<div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
			{["tools/list", "tools/call", "next_sequence"].map((label) => (
				<span
					key={label}
					className="rounded border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[var(--ink-muted)]"
				>
					{label}
				</span>
			))}
		</div>
	);
}

function ClosingPanel() {
	return (
		<section className="border-t border-[var(--border)]">
			<div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
				<div className="flex flex-col items-start gap-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8 md:flex-row md:items-center md:justify-between md:p-12">
					<div>
						<h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)] md:text-[1.75rem]">
							Ready to take a number?
						</h2>
						<p className="mt-2 text-[15px] text-[var(--ink-muted)]">
							Sign in with GitHub, then point your MCP client at this server.
						</p>
					</div>
					<ClientOnly fallback={<HeroCtaSkeleton />}>
						<HeroCta />
					</ClientOnly>
				</div>
			</div>
		</section>
	);
}
