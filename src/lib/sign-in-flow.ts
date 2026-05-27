export function buildSignInRoute(returnTo: string) {
	const params = new URLSearchParams({
		returnTo,
	});

	return `/sign-in?${params.toString()}`;
}

export function getAuthorizationResumePath(searchParams: URLSearchParams) {
	const hasAuthorizationParams =
		searchParams.has("client_id") &&
		searchParams.has("redirect_uri") &&
		searchParams.has("response_type") &&
		searchParams.has("state");

	if (hasAuthorizationParams) {
		return `/api/auth/oauth2/authorize?${searchParams.toString()}`;
	}

	return searchParams.get("returnTo");
}
