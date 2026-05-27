import { Button } from "@heroui/react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";

import { authClient } from "#/lib/auth-client.ts";
import { buildSignInRoute } from "#/lib/sign-in-flow.ts";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<div className="p-8">
			<h1 className="text-4xl font-bold">Welcome to TanStack Start</h1>
			<p className="mt-4 text-lg">
				Edit <code>src/routes/index.tsx</code> to get started.
			</p>
			<ClientOnly fallback={<Button isDisabled>Checking session...</Button>}>
				<AuthSessionButton />
			</ClientOnly>
		</div>
	);
}

function AuthSessionButton() {
	const { data } = authClient.useSession();

	async function handleLogin() {
		await authClient.signIn.social({
			provider: "github",
			callbackURL: `${window.location.origin}${buildSignInRoute("/")}`,
			scopes: ["user:email", "user:email", "read:org"],
		});
	}

	async function handleLogout() {
		await authClient.signOut();
	}

	console.log(data);

	return (
		<div>
			<Button
				onPress={() => {
					if (data) {
						void handleLogout();
					} else {
						void handleLogin();
					}
				}}
			>
				{data ? "Sign-out" : "Login in with github"}
			</Button>
		</div>
	);
}
