export function buildSignInRoute(returnTo: string) {
	const params = new URLSearchParams({
		returnTo,
	});

	return `/sign-in?${params.toString()}`;
}

export function isAuthorizationRequest(searchParams: URLSearchParams) {
	return (
		searchParams.has("client_id") &&
		searchParams.has("redirect_uri") &&
		searchParams.has("response_type") &&
		searchParams.has("state")
	);
}

export function getAuthorizationResumePath(searchParams: URLSearchParams) {
	if (isAuthorizationRequest(searchParams)) {
		return `/api/auth/oauth2/authorize?${searchParams.toString()}`;
	}

	return searchParams.get("returnTo");
}
