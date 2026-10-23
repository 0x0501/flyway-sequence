import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import { expect, test } from "vitest";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const journal = JSON.parse(
	await readFile(join(root, "drizzle/meta/_journal.json"), "utf8"),
) as { entries: { tag: string; when: number }[] };

async function migrationFixture(failUpgrade = false) {
	const db = new Database(":memory:");
	const directory = await mkdtemp(join(tmpdir(), "flyway-drizzle-test-"));
	db.exec(
		"CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
	);
	for (const entry of journal.entries.slice(0, 4)) {
		const sql = await readFile(join(root, `drizzle/${entry.tag}.sql`), "utf8");
		db.exec(sql);
		db.prepare(
			"INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
		).run(createHash("sha256").update(sql).digest("hex"), entry.when);
	}
	db.exec(
		"INSERT INTO sequences (sequence_date, sequence) VALUES (20261023, 42)",
	);
	const writes: string[] = [];
	const failures: string[] = [];
	const server = createServer(async (request, response) => {
		try {
			expect(request.headers.authorization).toBe("Bearer fixture-token");
			const chunks: Buffer[] = [];
			for await (const chunk of request) chunks.push(Buffer.from(chunk));
			const { sql, params = [] } = JSON.parse(
				Buffer.concat(chunks).toString(),
			) as { sql: string; params?: (string | number | null)[] };
			if (
				failUpgrade &&
				sql.includes("CREATE TABLE `oauth_client_assertion`")
			) {
				failures.push(sql);
				throw new Error("fixture migration failure");
			}
			const statement = db.prepare(sql);
			let results: unknown = [];
			if (statement.reader) {
				results = request.url?.endsWith("/raw")
					? { rows: statement.raw().all(...params) }
					: statement.all(...params);
			} else {
				db.exec(sql);
				writes.push(sql);
			}
			response.setHeader("content-type", "application/json");
			response.end(
				JSON.stringify({
					success: true,
					result: [{ success: true, results }],
				}),
			);
		} catch (error) {
			response.setHeader("content-type", "application/json");
			response.end(
				JSON.stringify({
					success: false,
					errors: [{ code: 7500, message: String(error) }],
				}),
			);
		}
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("No fixture port");
	const preload = join(directory, "d1-transport.cjs");
	// Exercise the real CLI while routing its HTTPS requests to a local D1 fixture.
	await writeFile(
		preload,
		`const https = require('node:https');
const http = require('node:http');
https.request = (input, options, callback) => {
  const url = new URL(input);
  const path = '/client/v4/accounts/fixture-account/d1/database/fixture-db/';
  if (url.origin !== 'https://api.cloudflare.com' ||
      !['query', 'raw'].some(method => url.pathname === path + method)) {
    throw new Error('Unexpected external request: ' + url.origin);
  }
  return http.request('http://127.0.0.1:${address.port}' + url.pathname,
    { ...options, protocol: 'http:' }, callback);
};
`,
	);
	return {
		db,
		writes,
		failures,
		migrate: () =>
			run("bun", ["run", "db:migrate"], {
				cwd: root,
				env: {
					...process.env,
					NODE_OPTIONS: `--require=${preload}`,
					CLOUDFLARE_ACCOUNT_ID: "fixture-account",
					CLOUDFLARE_DATABASE_ID: "fixture-db",
					CLOUDFLARE_D1_TOKEN: "fixture-token",
				},
				timeout: 15_000,
			}),
		close: async () => {
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			);
			db.close();
			await rm(directory, { recursive: true, force: true });
		},
	};
}

test("deployment migration preserves the existing Drizzle history and skips completed SQL", async () => {
	const fixture = await migrationFixture();
	try {
		await fixture.migrate();
		expect(
			fixture.db
				.prepare(
					"SELECT created_at FROM __drizzle_migrations ORDER BY created_at",
				)
				.all(),
		).toEqual(journal.entries.map((entry) => ({ created_at: entry.when })));
		expect(fixture.db.prepare("SELECT sequence FROM sequences").get()).toEqual({
			sequence: 42,
		});
		expect(
			fixture.db.prepare("SELECT * FROM github_org_membership").all(),
		).toEqual([]);
		fixture.writes.length = 0;
		await fixture.migrate();
		expect(
			fixture.writes.filter(
				(sql) => !sql.includes("CREATE TABLE IF NOT EXISTS"),
			),
		).toEqual([]);
	} finally {
		await fixture.close();
	}
});

test("a failed D1 migration exits unsuccessfully without marking it applied", async () => {
	const fixture = await migrationFixture(true);
	try {
		await expect(fixture.migrate()).rejects.toMatchObject({ code: 1 });
		expect(fixture.failures).toHaveLength(1);
		expect(
			fixture.db
				.prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations")
				.get(),
		).toEqual({ count: 4 });
		expect(fixture.db.prepare("SELECT sequence FROM sequences").get()).toEqual({
			sequence: 42,
		});
	} finally {
		await fixture.close();
	}
});
