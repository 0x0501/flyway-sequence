# Agent instruction: upgrade an existing Flyway Sequence client

Use the following instruction with an agent that can edit your local MCP configuration.

---

Upgrade my existing `flyway-sequence` MCP connection to the current service at
`https://flyway.ynbr.one/api/mcp`. Complete the local configuration changes and verify
the connection, asking me only for missing client IDs or interactive sign-in steps.

1. Identify my MCP application, installed version, configuration file, and configuration
   scope. Check the installed CLI help before running commands. Upgrade the application
   if it cannot negotiate MCP revision `2026-07-28`. For Claude Code, use version
   `2.1.274` or newer and restart it after upgrading.

2. Obtain a pre-registered public OAuth client ID for this application. Reuse the team's
   registration when available: registration is per application, not per user. If no
   suitable registration exists, guide me to sign in at `https://flyway.ynbr.one/clients`
   with my GitHub organization account and register a `native` application with its
   callback URI. Claude Code uses `http://localhost:8080/callback` with callback port
   `8080`. Codex normally uses `http://127.0.0.1/callback`; register the exact callback
   displayed by `codex mcp add` if it differs. Never invent a client ID. The service uses
   public clients with S256 PKCE, without client secrets. DCR and CIMD are unavailable.

3. Clear stored authentication for this server using the application's supported logout
   or clear-authentication command. Remove the old `flyway-sequence` entry at its existing
   scope, including any old `mcp-remote` launch command or static Authorization header.
   Preserve unrelated MCP entries and credentials. Do not delete entire configuration
   files or shared authentication-cache directories. Remove duplicate entries for this
   service if they would override the replacement.

4. Configure a direct HTTP connection with the registered client ID. Replace the client-ID
   placeholders below with the real IDs. Preserve the original configuration scope;
   adjust the Claude Code `--scope` value accordingly.

   For Claude Code:

   ```bash
   claude mcp logout flyway-sequence
   claude mcp remove --scope user flyway-sequence
   claude mcp add --transport http --scope user \
     --client-id CLAUDE_CLIENT_ID --callback-port 8080 \
     flyway-sequence https://flyway.ynbr.one/api/mcp
   claude mcp login flyway-sequence
   ```

   The `/mcp` panel also supports clearing authentication and signing in. If the old entry
   is absent or has no stored authentication, continue with adding the replacement.

   For Codex:

   ```bash
   codex mcp logout flyway-sequence
   codex mcp remove flyway-sequence
   codex mcp add flyway-sequence --url https://flyway.ynbr.one/api/mcp \
     --oauth-client-id CODEX_CLIENT_ID
   codex mcp login flyway-sequence --scopes openid,profile,email,offline_access,mcp:write
   ```

   If Codex is configured through a project configuration file, update that scope rather
   than leaving an overriding project entry. For other applications, use their equivalent
   HTTP transport, pre-registered client ID, PKCE, callback, and OAuth settings.

5. Let me complete GitHub sign-in and consent in the browser. Request `mcp:write` for tool
   access and `offline_access` for refresh tokens; remove obsolete `mcp:read` settings.
   Use my own account, which must be an active member of the configured GitHub organization.
   Do not copy another user's tokens or put access tokens into MCP configuration files.

6. Reconnect or restart the application and verify initialization and tool discovery.
   Confirm that `next_sequence` and `rollback_sequence` are available. Do not call either
   tool as a connectivity test: both change shared state. Allocate a version only when I
   request a migration, and roll one back only when I explicitly request retraction.
   If the service returns a database or HTTP 500 error, report it to the service maintainer
   rather than changing production data as part of this client upgrade.

7. Report the application version, changed configuration path and scope, endpoint,
   authentication status, and tool-discovery result. State any remaining browser action
   or server-side blocker. Never include tokens, cookies, or secrets in the report.

---

Client configuration references: [Claude Code MCP](https://code.claude.com/docs/en/mcp)
and [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
