import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { buildSignInRoute } from "#/lib/sign-in-flow.ts";
import { ensurePoolAccess } from "#/server/access.ts";
import { getSequence } from "#/server/sequence.ts";

export const Route = createFileRoute("/pool")({
	beforeLoad: async () => {
		const { authorized } = await ensurePoolAccess();
		if (!authorized) {
			throw redirect({ href: buildSignInRoute("/pool") });
		}
	},
	component: PoolRoute,
});

type PoolState =
	| { status: "loading" }
	| { status: "ready"; sequence: string }
	| { status: "empty"; message: string | null }
	| { status: "error"; message: string };

function formatCheckedAt(date: Date) {
	return date.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function PoolRoute() {
	const getSeq = useServerFn(getSequence);
	const [state, setState] = useState<PoolState>({ status: "loading" });
	const [checkedAt, setCheckedAt] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const load = useCallback(async () => {
		setState({ status: "loading" });
		try {
			const res = await getSeq();
			if (res.success && res.sequence) {
				setState({ status: "ready", sequence: res.sequence });
			} else {
				setState({ status: "empty", message: res.message });
			}
			setCheckedAt(formatCheckedAt(new Date()));
		} catch (e) {
			setState({ status: "error", message: (e as Error).message });
		}
	}, [getSeq]);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		return () => {
			if (copyTimer.current) {
				clearTimeout(copyTimer.current);
			}
		};
	}, []);

	const handleCopy = useCallback(async (value: string) => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			if (copyTimer.current) {
				clearTimeout(copyTimer.current);
			}
			copyTimer.current = setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard unavailable (e.g. insecure context); the value stays
			// selectable for manual copy.
		}
	}, []);

	const isLoading = state.status === "loading";

	return (
		<div className="px-6 py-16 md:py-24">
			<div className="mx-auto flex w-full max-w-xl flex-col">
				<div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8 md:p-10">
					<div className="space-y-2">
						<p className="text-xs font-medium text-[var(--accent)]">Pool</p>
						<h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] md:text-[1.75rem]">
							Current migration sequence
						</h1>
						<p className="text-[15px] leading-relaxed text-[var(--ink-muted)]">
							The latest centralized Flyway sequence allocated for today
							(Asia/Shanghai). Copy it straight into your migration filename.
						</p>
					</div>

					<div className="my-7 h-px bg-[var(--border)]" />

					{isLoading ? (
						<div className="space-y-3">
							<div className="h-11 w-3/4 animate-pulse rounded-md bg-[var(--border)]" />
							<div className="h-4 w-40 animate-pulse rounded bg-[var(--border)]" />
						</div>
					) : null}

					{state.status === "ready" ? (
						<div className="space-y-5">
							<p className="select-all break-all font-mono text-4xl font-semibold tracking-tight text-[var(--ink)] md:text-5xl">
								{state.sequence}
							</p>
							<div className="flex items-center justify-between gap-4">
								<span className="text-xs text-[var(--ink-subtle)]">
									{checkedAt ? `Last checked ${checkedAt}` : null}
								</span>
								<button
									type="button"
									onClick={() => {
										void handleCopy(state.sequence);
									}}
									className={`inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors active:translate-y-px ${
										copied
											? "border-[color:color-mix(in_oklab,var(--accent)_30%,transparent)] bg-[var(--accent-soft)] text-[var(--accent)]"
											: "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--ink)] hover:bg-[var(--bg)]"
									}`}
								>
									{copied ? "Copied" : "Copy"}
								</button>
							</div>
						</div>
					) : null}

					{state.status === "empty" ? (
						<div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm leading-relaxed text-[var(--ink-muted)]">
							<p className="font-medium text-[var(--ink)]">
								No sequence allocated yet today
							</p>
							<p className="mt-0.5">
								Allocate one via the MCP endpoint to see it here.
							</p>
						</div>
					) : null}

					{state.status === "error" ? (
						<div className="rounded-xl border border-[color:color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[var(--danger-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--danger)]">
							<p className="font-medium text-[var(--ink)]">
								Could not load the sequence
							</p>
							<p className="mt-0.5">{state.message}</p>
						</div>
					) : null}

					<div className="mt-7 flex justify-end">
						<button
							type="button"
							disabled={isLoading}
							onClick={() => {
								void load();
							}}
							className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--bg)] active:translate-y-px disabled:opacity-50"
						>
							{isLoading ? "Loading" : "Refresh"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
