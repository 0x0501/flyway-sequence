const HOUR = 60 * 60;
const DAY = 24 * HOUR;

export const AUTH_CACHE_SECONDS = 10 * 60;
export const tokenLifetimes = {
	access: DAY,
	id: DAY,
	session: 30 * DAY,
	refresh: 180 * DAY,
	authorizationCode: 15 * 60,
} as const;

export const oauthScopes = [
	"openid",
	"profile",
	"email",
	"offline_access",
	"mcp:write",
] as const;
