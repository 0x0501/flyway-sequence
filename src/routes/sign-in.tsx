import {
	Button,
	Card,
	CardBody,
	CardFooter,
	CardHeader,
	Link,
} from "@heroui/react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { authClient } from "#/lib/auth-client.ts";
import { getAuthorizationResumePath } from "#/lib/sign-in-flow.ts";

export const Route = createFileRoute("/sign-in")({
	component: SignInRoute,
});

function SignInRoute() {
	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_32%),linear-gradient(135deg,#020617,#111827_52%,#0f172a)] px-4 py-10 text-slate-50">
			<div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
				<ClientOnly fallback={<SignInFallback />}>
					<SignInCard />
				</ClientOnly>
			</div>
		</div>
	);
}

function SignInFallback() {
	return (
		<Card className="w-full max-w-xl border border-white/10 bg-white/10 text-white shadow-2xl backdrop-blur">
			<Card.Content className="py-14 text-center text-white/70">
				Preparing GitHub sign-in...
			</Card.Content>
		</Card>
	);
}

function SignInCard() {
	const { data: session, isPending } = authClient.useSession();
	const [orgCheckState, setOrgCheckState] = useState<
		"idle" | "checking" | "authorized" | "denied"
	>("idle");
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

	if (isPending) {
		return <SignInFallback />;
	}

	return (
		<Card className="w-full max-w-xl border border-white/10 bg-slate-950/85 text-white shadow-2xl">
			<CardHeader className="flex flex-col items-start gap-3">
				<p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
					GitHub Sign-in
				</p>
				<div className="space-y-2">
					<h1 className="text-3xl font-semibold">
						Authorize organization members only
					</h1>
					<p className="text-sm leading-7 text-white/70">
						Sign in with GitHub to continue the OAuth flow. We only issue MCP
						access tokens to members of the approved GitHub organization.
					</p>
				</div>
			</CardHeader>
			<CardBody className="space-y-4">
				{session ? (
					<>
						<div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
							Signed in as{" "}
							{session.user.name ?? session.user.email ?? session.user.id}.
						</div>
						{orgCheckState === "checking" ? (
							<div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
								Verifying GitHub organization membership...
							</div>
						) : null}
						{orgCheckState === "authorized" ? (
							<div className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
								GitHub organization access verified.
							</div>
						) : null}
						{orgCheckState === "denied" ? (
							<div className="rounded-2xl border border-rose-300/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
								{error}
							</div>
						) : null}
					</>
				) : (
					<div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
						We will request GitHub organization-read access so membership can be
						verified before any MCP token is issued.
					</div>
				)}
			</CardBody>
			<CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end">
				{session && orgCheckState === "authorized" && nextHref ? (
					<Link
						className="w-full bg-cyan-300 font-semibold text-slate-950 sm:w-auto"
						href={nextHref}
					>
						Continue
					</Link>
				) : (
					<Button
						className="w-full bg-cyan-300 font-semibold text-slate-950 sm:w-auto"
						isDisabled={orgCheckState === "checking"}
						onPress={() => {
							void handleSignIn();
						}}
					>
						{session && orgCheckState === "denied"
							? "Sign in with another GitHub account"
							: "Sign in with GitHub"}
					</Button>
				)}
			</CardFooter>
		</Card>
	);
}
