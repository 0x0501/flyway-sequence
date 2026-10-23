# Flyway Sequence

A centralized Flyway version allocation service built with Cloudflare Workers, D1, and
TanStack Start. Versions use the current date in Shanghai, for example `V20261022_001__`.

## Local development

Requires Bun 1.4.3+ and Node.js 24+. Bun manages dependencies and runs scripts; the deployed
application runs on Cloudflare Workers.

```bash
bun install --frozen-lockfile
cp .env.example .env.local
# Set the GitHub OAuth credentials, organization, and BETTER_AUTH_SECRET
bunx wrangler d1 migrations apply DB --local
bun run dev
```

Set the GitHub OAuth App callback URL to `http://localhost:3000/api/auth/callback/github`.
Use the corresponding deployment domain in production. GitHub sign-in requests `read:org`;
only active members of the configured organization can access protected features.

## Register MCP clients

1. Sign in with an organization member account and open `/clients`.
2. Enter the application name, application type, and exact callback URIs supplied by the
   client. Choose `native` for desktop or CLI applications and `web` for browser applications.
   Register each application once; individual users do not need separate registrations.
3. Configure the generated `client_id` in the application. The page creates public clients
   that use S256 PKCE and do not require a client secret.
4. Users sign in with GitHub and grant consent before the client can call tools.

The project has no separate administrator role. GitHub organization members can register
applications. The registration list shows applications created by the current account;
the generated client ID can be shared with other users of the same application.

For Claude Code, register `http://localhost:8080/callback`:

```bash
claude mcp add --transport http --client-id YOUR_CLIENT_ID --callback-port 8080 \
  flyway-sequence https://YOUR_DEPLOYMENT/api/mcp
```

For Codex, register `http://127.0.0.1/callback`. The port for native loopback URIs is selected
at sign-in according to RFC 8252:

```bash
codex mcp add flyway-sequence --url https://YOUR_DEPLOYMENT/api/mcp --oauth-client-id YOUR_CLIENT_ID
codex mcp login flyway-sequence --scopes openid,profile,email,offline_access,mcp:write
```

Use a client version that supports MCP `2026-07-28`. See the
[Claude Code documentation](https://code.claude.com/docs/en/mcp#use-pre-configured-oauth-credentials)
and [Codex documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) for configuration details.

## MCP and authentication architecture

- `/api/mcp` accepts POST requests only. It uses `createMcpHandler` from the official
  `@modelcontextprotocol/server` v2 SDK, creates a separate server for each request, and sets
  `legacy: "reject"`.
- `next_sequence` allocates versions atomically. `rollback_sequence` is reserved for cases
  where the user explicitly asks to retract a version. Both require `mcp:write`.
- `@better-auth/mcp` handles OAuth 2.1, PKCE, consent, resource binding, and discovery metadata.
  Clients must be registered in advance. DCR is disabled, and CIMD is not installed.
- MCP requests validate the signature, issuer, audience, expiration, scope, and DPoP binding.
  Better Auth's verification functions read local JWKS directly and use the library's public
  key cache, avoiding requests from a Worker to its own domain.
- GitHub organization checks run during OAuth authorization and consent, client management,
  and protected Pool operations. Successful results are cached per user and organization for
  10 minutes in D1, across Worker instances. Failed checks do not extend the cache.
- Browser sessions use Better Auth's signed cookie cache for 10 minutes. MCP tool requests
  use access tokens without repeating GitHub or browser session checks.

| Credential | Lifetime |
| --- | --- |
| OAuth access token | 24 hours |
| OIDC ID token | 24 hours |
| Login session | 30 days, renewed on Better Auth's default update schedule |
| OAuth refresh token | 180 days, reissued on rotation |
| Single-use authorization code | 15 minutes |
| Browser session cache | 10 minutes |
| GitHub organization membership cache | 10 minutes |

These settings are defined in `src/lib/auth-policy.ts`. Lifetimes apply to newly issued or
renewed credentials; existing JWT `exp` claims are not changed retroactively. GitHub controls
the lifetime of tokens it issues. Session revocation and organization membership changes may
take effect after the 10-minute cache expires. Issued OAuth JWTs remain subject to their own
expiration times.

Discovery endpoints:

- `/.well-known/oauth-protected-resource/api/mcp`
- `/.well-known/oauth-authorization-server/api/auth`
- `/api/auth/.well-known/openid-configuration`

Implementation references: [MCP SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/),
[Better Auth MCP](https://better-auth.com/docs/plugins/mcp),
[session caching](https://better-auth.com/docs/concepts/session-management), and the
[1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide).

## Validation

```bash
bun run typecheck
bun run check
bun run test
bun run build
```

Tests cover the OAuth authorization code flow with PKCE, token lifetimes, public key caching,
organization membership caching, official MCP client calls, and preservation of existing data
during database migrations.

## Database migrations and deployment

`0004_better_auth_1_7.sql` upgrades the OAuth schema and migrates client types and authentication
methods before removing the old columns. `0005_org_membership_cache.sql` adds the organization
membership cache. Published migration history is retained so existing databases can be upgraded.

Before upgrading, check for duplicate accounts and legacy client types:

```sql
SELECT provider_id, account_id, COUNT(*) FROM account
GROUP BY provider_id, account_id HAVING COUNT(*) > 1;
SELECT client_id, type FROM oauth_client
WHERE type IS NOT NULL AND type NOT IN ('web', 'native');
```

Run the second query only on databases that have not applied `0004`. If any clients have the
`user-agent-based` type, confirm their callback type and change it to `web` or `native` first.
Machine clients are outside this project's authorization flow; the migration does not grant
them new machine scopes.

Validate the migrations in a test environment first, then build and deploy the corresponding
code during a maintenance window. The deploy script applies pending production D1 migrations
before publishing the Worker. A migration failure stops the deployment:

```bash
bunx wrangler login
# Prepare .env.prod using .env.prod.example
bun run build
bun run deploy --secrets-file .env.prod
```

`.env.prod` and `.env.local` contain sensitive information and must not be committed.
Cloudflare account, database, and token settings for the Drizzle CLI are used only for database
administration. The Worker accesses the database through its D1 binding at runtime.

After changing the Auth configuration, regenerate the schema:

```bash
bun run auth:generate
bun run db:generate
```

`auth.config.ts` is used only for CLI schema generation. It does not create an Auth instance
with an empty database during Worker startup.

## Automatic deployment with Workers Builds

In the Cloudflare dashboard, open **Workers & Pages > flyway-sequence > Settings > Builds**
and connect the `0x0501/flyway-sequence` GitHub repository. Grant the Cloudflare GitHub App access
to this repository. The Worker name must match `name` in `wrangler.jsonc`: `flyway-sequence`.

Configure the build settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | Repository root (`/`) |
| Build command | `bun install --frozen-lockfile && bun run typecheck && bun run check && bun run test && bun run build` |
| Deploy command | `bun run deploy` |
| Preview builds | Disabled for a production-only setup |

Under **Settings > Builds > Build Variables and Secrets**, add:

| Variable | Value |
| --- | --- |
| `BUN_VERSION` | `1.4.3` |
| `NODE_VERSION` | `24` |
| `SKIP_DEPENDENCY_INSTALL` | `true` |
| `VITE_APP_URL` | `https://flyway.ynbr.one` or your production origin, without a trailing slash |

The build command installs dependencies from `bun.lock`. `VITE_APP_URL` is compiled into the
browser bundle. After the build succeeds, the deploy command applies pending production D1
migrations and publishes the Worker only if they succeed. Applied migrations are tracked by
Wrangler in `d1_migrations` and are skipped on subsequent deployments.

The API token selected in **Builds > API token** must have **Account > D1 > Edit** permission
for the account containing the database, in addition to its Worker deployment permissions.
The automatically generated Builds token does not include D1 access by default; edit its
permissions under **My Profile > API Tokens**, or select a token with both permissions.

Under the Worker's **Settings > Variables and Secrets**, configure runtime values separately:

| Name | Type | Value |
| --- | --- | --- |
| `BETTER_AUTH_URL` | Text | `https://flyway.ynbr.one` or your production origin |
| `MCP_RESOURCE_URL` | Text | The same origin followed by `/api/mcp` |
| `GITHUB_ORGANIZATION` | Text | The GitHub organization allowed to use the service |
| `GITHUB_CLIENT_ID` | Text | Your GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Secret | Your GitHub OAuth App client secret |
| `BETTER_AUTH_SECRET` | Secret | A stable, securely generated authentication secret |

Build variables are not runtime bindings. `--keep-vars` preserves text variables configured
in the dashboard; deployments also retain existing secrets. The `DB` D1 binding is already
declared in `wrangler.jsonc`; confirm its database ID belongs to your Cloudflare account.
Database administration credentials from `.env.prod.example` are not needed by the application.

Set the GitHub OAuth App callback URL to your production origin followed by
`/api/auth/callback/github`. Keep the authentication secret stable across deployments.

Before the first deployment of the upgraded Auth implementation, review the migration checks
above. The deploy script uses the source Wrangler configuration to resolve `DB` and the
`drizzle/` migration directory, then deploys the output generated by the Cloudflare Vite plugin:

```bash
bun run db:migrate
# Runs: wrangler d1 migrations apply DB --remote --config wrangler.jsonc
# The deploy script runs this automatically before wrangler deploy --keep-vars.
```

In Workers Builds, use `bun run deploy` without a secrets file. The application is already
built by the build command, and runtime variables and secrets come from the Worker's dashboard
configuration. For local deployments, the optional `--secrets-file .env.prod` argument shown
above forwards the local secrets file to the Worker deploy command.

Push the skill submodule commit before pushing the parent repository whenever both change.
After the commits are available remotely and Builds is connected, every push or merge to
`main` runs the build command, applies pending D1 migrations, and deploys after both succeed.
Commit new migration SQL files under `drizzle/`; future deployments apply them automatically.
Migrations run while the current Worker version is still serving requests, so schema changes
must remain compatible with that version until the new Worker is deployed. If Worker deployment
fails after migrations succeed, those schema changes remain applied for the next deployment.

See Cloudflare's [Workers Builds setup](https://developers.cloudflare.com/workers/ci-cd/builds/),
[build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
[build image settings](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/),
and [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/).
