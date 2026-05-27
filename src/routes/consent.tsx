import {
	Button,
	Card,
	CardFooter,
	CardHeader,
	Link,
	Separator,
	Spinner,
} from "@heroui/react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { authClient } from "#/lib/auth-client.ts";
import { getErrorMessage } from "#/lib/error-message.ts";

export const Route = createFileRoute("/consent")({
	component: ConsentRoute,
});

function ConsentRoute() {
	return (
		<div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-10 text-slate-50">
			<div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
				<ClientOnly fallback={<ConsentFallback />}>
					<ConsentCard />
				</ClientOnly>
			</div>
		</div>
	);
}

function ConsentFallback() {
	return (
		<Card className="w-full max-w-2xl border border-white/10 bg-white/10 text-white shadow-2xl backdrop-blur">
			<Card.Content className="flex items-center gap-4 py-14 text-center">
				<Spinner color="current" size="lg" />
				<div>
					<p className="text-lg font-semibold">Loading authorization request</p>
					<p className="text-sm text-white/70">
						Checking your session and requested scopes.
					</p>
				</div>
			</Card.Content>
		</Card>
	);
}

function ConsentCard() {
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
		return <ConsentFallback />;
	}

	if (!session) {
		return (
			<Card className="w-full max-w-2xl border border-amber-300/30 bg-slate-950/85 text-white shadow-2xl">
				<CardHeader className="flex flex-col items-start gap-2">
					<p className="text-sm uppercase tracking-[0.3em] text-amber-300">
						Sign in required
					</p>
					<h1 className="text-3xl font-semibold">
						You need an account session first
					</h1>
				</CardHeader>
				<Card.Content className="space-y-3 text-white/75">
					<p>
						This OAuth authorization request can only continue after you sign in
						with GitHub.
					</p>
				</Card.Content>
				<CardFooter>
					<Link
						className="bg-amber-300 font-semibold text-slate-950"
						href={signInHref}
					>
						Go to sign in
					</Link>
				</CardFooter>
			</Card>
		);
	}

	return (
		<Card className="w-full max-w-2xl border border-white/10 bg-slate-950/85 text-white shadow-2xl">
			<CardHeader className="flex flex-col items-start gap-3">
				<p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
					OAuth Authorization
				</p>
				<div className="space-y-2">
					<h1 className="text-3xl font-semibold">Grant MCP access</h1>
					<p className="text-sm text-white/70">
						Signed in as{" "}
						<span className="font-medium text-white">
							{session.user.name ?? session.user.email ?? session.user.id}
						</span>
					</p>
				</div>
			</CardHeader>
			<Separator className="bg-white/10" />
			<Card.Content className="space-y-6">
				<p className="text-sm leading-7 text-white/75">
					This client is requesting permission to call your MCP tools. Access is
					issued only to approved GitHub organization members.
				</p>

				<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
					<p className="text-xs uppercase tracking-[0.25em] text-white/45">
						Requested scopes
					</p>
					<div className="mt-3 flex flex-wrap gap-2">
						{scopes.length > 0 ? (
							scopes.map((scope) => (
								<span
									key={scope}
									className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100"
								>
									{scope}
								</span>
							))
						) : (
							<span className="text-sm text-white/55">
								No explicit scopes were requested.
							</span>
						)}
					</div>
				</div>

				{error ? (
					<div className="rounded-2xl border border-rose-300/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
						{error}
					</div>
				) : null}
			</Card.Content>
			<CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end">
				<Button
					className="w-full border border-white/15 bg-transparent text-white sm:w-auto"
					isDisabled={isSubmitting}
					onPress={() => {
						void handleConsent(false);
					}}
					variant="outline"
				>
					Deny
				</Button>
				<Button
					className="w-full bg-cyan-300 font-semibold text-slate-950 sm:w-auto"
					isPending={isSubmitting}
					onPress={() => {
						void handleConsent(true);
					}}
				>
					Authorize MCP access
				</Button>
			</CardFooter>
		</Card>
	);
}
