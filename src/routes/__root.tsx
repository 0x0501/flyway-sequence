import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRoute,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import BetterAuthHeader from "#/integrations/better-auth/header-user.tsx";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Flyway Sequence",
			},
			{
				name: "description",
				content:
					"A centralized server that issues sequential Flyway migration numbers, gated by GitHub organization membership.",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="bg-[var(--bg)] text-[var(--ink)] antialiased">
				<div className="flex min-h-[100dvh] flex-col">
					<SiteHeader />
					<main className="flex-1">{children}</main>
					<SiteFooter />
				</div>
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}

function SiteHeader() {
	return (
		<header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
				<Link
					to="/"
					className="flex items-center gap-2.5 text-[15px] font-medium tracking-tight text-[var(--ink)]"
				>
					<span>Flyway Sequence</span>
				</Link>
				<nav className="hidden items-center gap-7 text-sm text-[var(--ink-muted)] md:flex">
					<a href="#how" className="transition-colors hover:text-[var(--ink)]">
						How it works
					</a>
					<a href="#what" className="transition-colors hover:text-[var(--ink)]">
						What it does
					</a>
					<a
						href="https://github.com"
						className="transition-colors hover:text-[var(--ink)]"
					>
						Source
					</a>
				</nav>
				<BetterAuthHeader />
			</div>
		</header>
	);
}

function SiteFooter() {
	return (
		<footer className="border-t border-[var(--border)]">
			<div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-[var(--ink-subtle)] sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2.5">
					<span>Flyway Sequence</span>
				</div>
				<div className="flex items-center gap-6">
					<a
						className="hover:text-[var(--ink)]"
						href="/.well-known/oauth-authorization-server"
					>
						OAuth metadata
					</a>
				</div>
			</div>
		</footer>
	);
}

function BrandMark() {
	return (
		<svg
			aria-hidden="true"
			width="22"
			height="22"
			viewBox="0 0 22 22"
			fill="none"
			className="text-[var(--accent)]"
		>
			<title>Flyway Sequence</title>
			<rect
				x="1"
				y="1"
				width="20"
				height="20"
				rx="5"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<path
				d="M6 13.5 9 10.5 12 12.5 16 8"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
