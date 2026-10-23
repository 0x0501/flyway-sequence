import { Link } from "@tanstack/react-router";
import { authClient } from "#/lib/auth-client";

export default function PoolNavLink() {
	const { data: session } = authClient.useSession();
	return session ? (
		<>
			<Link to="/pool" className="transition-colors hover:text-[var(--ink)]">
				Pool
			</Link>
			<Link to="/clients" className="transition-colors hover:text-[var(--ink)]">
				Clients
			</Link>
		</>
	) : null;
}
