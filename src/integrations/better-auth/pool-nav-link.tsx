import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { authClient } from "#/lib/auth-client";

export default function PoolNavLink() {
	const { data: session } = authClient.useSession();
	const [authorized, setAuthorized] = useState(false);

	useEffect(() => {
		if (!session?.user) {
			setAuthorized(false);
			return;
		}

		let isMounted = true;

		async function verify() {
			try {
				const response = await fetch("/api/auth/github-org-access", {
					credentials: "include",
				});
				const data = (await response.json()) as { authorized?: boolean };
				if (isMounted) {
					setAuthorized(response.ok && data.authorized === true);
				}
			} catch {
				if (isMounted) {
					setAuthorized(false);
				}
			}
		}

		void verify();

		return () => {
			isMounted = false;
		};
	}, [session]);

	if (!authorized) {
		return null;
	}

	return (
		<Link to="/pool" className="transition-colors hover:text-[var(--ink)]">
			Pool
		</Link>
	);
}
