export function getAuthIssuer(baseUrl: string) {
	return new URL("/api/auth", ensureTrailingSlash(baseUrl)).toString();
}

function ensureTrailingSlash(url: string) {
	return url.endsWith("/") ? url : `${url}/`;
}
