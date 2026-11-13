import { clientEnv } from "#/clientEnv.ts";

export const bearerInstallSnippets = {
	"claude-code": `claude mcp add --transport http flyway-sequence ${clientEnv.VITE_APP_URL}/api/mcp \\
  --header "Authorization: Bearer YOUR_PERSONAL_TOKEN"`,
	codex: `export FLYWAY_SEQUENCE_TOKEN='YOUR_PERSONAL_TOKEN'
codex mcp add flyway-sequence --url ${clientEnv.VITE_APP_URL}/api/mcp \\
  --bearer-token-env-var FLYWAY_SEQUENCE_TOKEN`,
};
