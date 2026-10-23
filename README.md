# Flyway Sequence

基于 Cloudflare Workers、D1、TanStack Start 的集中式 Flyway 版本号分配服务。版本按上海日期生成，例如 `V20261022_001__`。

## 本地开发

需要 Bun 1.4.3+ 和 Node.js 24+。Bun 负责依赖安装和脚本执行，部署运行时为 Cloudflare Workers。

```bash
bun install --frozen-lockfile
cp .env.example .env.local
# 填写 GitHub OAuth 配置、组织名和 BETTER_AUTH_SECRET
bunx wrangler d1 migrations apply DB --local
bun run dev
```

GitHub OAuth App 的回调地址为 `http://localhost:3000/api/auth/callback/github`。生产环境使用对应域名。GitHub 登录请求 `read:org`，只允许指定组织的有效成员访问受保护功能。

## 预登记 MCP 客户端

1. 使用组织成员账号登录，打开 `/clients`。
2. 填写客户端名称、应用类型和客户端提供的准确回调 URI。桌面/CLI 选 `native`，浏览器应用选 `web`。每个应用登记一次，无须逐个登记用户。
3. 将生成的 `client_id` 配置到客户端。页面创建的是使用 S256 PKCE 的 public client，不需要 client secret。
4. 用户通过 GitHub 登录并同意授权后，客户端即可调用工具。

目前项目没有独立的管理员角色，登记权限沿用 GitHub 组织成员权限。登记列表显示当前账号创建的应用；生成的客户端 ID 可以分发给同一应用的其他用户。

Claude Code 可登记 `http://localhost:8080/callback`：

```bash
claude mcp add --transport http --client-id YOUR_CLIENT_ID --callback-port 8080 \
  flyway-sequence https://YOUR_DEPLOYMENT/api/mcp
```

Codex 可登记 `http://127.0.0.1/callback`；原生回环 URI 的端口按 RFC 8252 在登录时选择：

```bash
codex mcp add flyway-sequence --url https://YOUR_DEPLOYMENT/api/mcp --oauth-client-id YOUR_CLIENT_ID
codex mcp login flyway-sequence --scopes openid,profile,email,offline_access,mcp:write
```

使用支持 MCP `2026-07-28` 的客户端版本。配置方式参见 [Claude Code 官方文档](https://code.claude.com/docs/en/mcp#use-pre-configured-oauth-credentials) 和 [Codex 官方文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。

## MCP 与鉴权架构

- `/api/mcp` 仅提供 POST，使用官方 `@modelcontextprotocol/server` v2 的 `createMcpHandler`，每个请求创建独立服务器，设置 `legacy: "reject"`。
- `next_sequence` 原子分配版本；`rollback_sequence` 仅用于用户明确要求撤回版本的场景。两者都需要 `mcp:write`。
- `@better-auth/mcp` 负责 OAuth 2.1、PKCE、授权同意、资源绑定和发现元数据。只采用预登记，关闭 DCR，不安装 CIMD。
- MCP 请求校验签名、issuer、audience、有效期、scope 和 DPoP 绑定。通过 Better Auth 官方校验函数直接读取本地 JWKS，使用官方公钥缓存，避免 Worker 请求自身域名。
- GitHub 组织校验集中在 OAuth 授权/同意、客户端登记与 Pool 的受保护操作。成功结果按用户和组织缓存 10 分钟，存于 D1，跨 Worker 实例生效；失败不会延长缓存。
- 浏览器登录使用 Better Auth 签名 cookie 缓存，时长 10 分钟。MCP 工具请求使用 access token，不重复调用 GitHub 或浏览器 session 校验。

| 凭据 | 有效期 |
| --- | --- |
| OAuth access token | 24 小时 |
| OIDC ID token | 24 小时 |
| 登录 session | 30 天，按 Better Auth 默认更新周期续期 |
| OAuth refresh token | 180 天，轮换时重新签发 |
| 一次性授权码 | 15 分钟 |
| 浏览器 session 缓存 | 10 分钟 |
| GitHub 组织成员缓存 | 10 分钟 |

配置集中在 `src/lib/auth-policy.ts`。新时长作用于新签发/续期的凭据；已签发 JWT 的 `exp` 不会被追溯修改。GitHub 颁发的 token 有效期由 GitHub 控制。session 撤销和组织成员资格变更可能在 10 分钟缓存过期后反映；已签发的 OAuth JWT 仍受自身到期时间约束。

发现地址：

- `/.well-known/oauth-protected-resource/api/mcp`
- `/.well-known/oauth-authorization-server/api/auth`
- `/api/auth/.well-known/openid-configuration`

实现依据：[MCP SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/)、[Better Auth MCP](https://better-auth.com/docs/plugins/mcp)、[会话缓存](https://better-auth.com/docs/concepts/session-management)、[1.7 升级指南](https://better-auth.com/docs/guides/1-7-upgrade-guide)。

## 验证

```bash
bun run typecheck
bun run check
bun run test
bun run build
```

测试包括实际 OAuth 授权码 + PKCE 流程、token 时长、公钥缓存、组织校验缓存、官方 MCP 客户端调用和数据库迁移数据保留。

## 数据迁移与部署

`0004_better_auth_1_7.sql` 升级 OAuth 数据结构，并在删除旧列前迁移客户端类型和认证方式；`0005_org_membership_cache.sql` 增加组织校验缓存。保留已经发布的迁移历史，以支持现有数据库升级。

升级前检查重复账号与旧客户端类型：

```sql
SELECT provider_id, account_id, COUNT(*) FROM account
GROUP BY provider_id, account_id HAVING COUNT(*) > 1;
SELECT client_id, type FROM oauth_client
WHERE type IS NOT NULL AND type NOT IN ('web', 'native');
```

第二条查询用于尚未应用 `0004` 的数据库。若存在 `user-agent-based` 客户端，先确认其回调类型并改为 `web` 或 `native`。机器客户端不属于本项目授权流程，迁移不会授予它们新的 machine scopes。

先在测试环境验证迁移，再在维护窗口应用生产迁移并部署对应代码：

```bash
bunx wrangler login
bunx wrangler d1 migrations apply DB --remote
# 按 .env.prod.example 准备 .env.prod
bun run deploy
```

`.env.prod` 和 `.env.local` 含敏感信息，不提交版本控制。Drizzle CLI 的 Cloudflare 账户、数据库和 token 配置仅在数据库管理时使用，Worker 运行时通过 D1 binding 访问数据库。

修改 Auth 配置后生成 schema：

```bash
bun run auth:generate
bun run db:generate
```

`auth.config.ts` 仅用于 CLI schema 生成，不在 Worker 启动时创建空数据库 Auth 实例。
