import { readdirSync, readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { expect, test } from "vitest";

const migrationsDir = new URL("../../../drizzle/", import.meta.url);
const upgradeName = "0004_better_auth_1_7.sql";

test("Better Auth 1.7 migration preserves registered clients, tokens and sequence data", () => {
	const db = new Database(":memory:");
	try {
		for (const name of readdirSync(migrationsDir)
			.filter((name) => name.endsWith(".sql") && name < upgradeName)
			.sort()) {
			db.exec(readFileSync(new URL(name, migrationsDir), "utf8"));
		}
		db.exec(`
			INSERT INTO user (id, name, email, updated_at) VALUES ('u1', 'Member', 'member@example.com', 1);
			INSERT INTO account (id, account_id, provider_id, user_id, updated_at)
			VALUES ('a1', 'github-123', 'github', 'u1', 1);
			INSERT INTO oauth_client (id, client_id, client_secret, redirect_uris, public, type, token_endpoint_auth_method)
			VALUES ('c1', 'public-client', NULL, '["http://localhost/callback"]', 1, 'native', NULL),
			       ('c2', 'confidential-client', 'hashed-secret', '["https://app.example.com/callback"]', 0, 'web', 'client_secret_post');
			INSERT INTO oauth_refresh_token (id, token, client_id, user_id, expires_at, created_at, scopes)
			VALUES ('r1', 'hashed-refresh', 'public-client', 'u1', 9999999999999, 1, '["mcp:write"]');
			INSERT INTO oauth_access_token (id, token, client_id, user_id, refresh_id, expires_at, created_at, scopes)
			VALUES ('t1', 'hashed-access', 'public-client', 'u1', 'r1', 9999999999999, 1, '["mcp:write"]');
			INSERT INTO sequences (sequence_date, sequence) VALUES (20261022, 42);
		`);
		db.exec(readFileSync(new URL(upgradeName, migrationsDir), "utf8"));
		expect(
			db
				.prepare(
					"SELECT client_id, application_type, token_endpoint_auth_method, client_credentials_scopes, client_discovery_id FROM oauth_client ORDER BY id",
				)
				.all(),
		).toEqual([
			{
				client_id: "public-client",
				application_type: "native",
				token_endpoint_auth_method: "none",
				client_credentials_scopes: "[]",
				client_discovery_id: null,
			},
			{
				client_id: "confidential-client",
				application_type: "web",
				token_endpoint_auth_method: "client_secret_post",
				client_credentials_scopes: "[]",
				client_discovery_id: null,
			},
		]);
		expect(
			db.prepare("SELECT token, refresh_id FROM oauth_access_token").get(),
		).toEqual({ token: "hashed-access", refresh_id: "r1" });
		expect(db.prepare("SELECT token FROM oauth_refresh_token").get()).toEqual({
			token: "hashed-refresh",
		});
		expect(db.prepare("SELECT sequence FROM sequences").get()).toEqual({
			sequence: 42,
		});
		expect(
			db.prepare("SELECT provider_id, account_id FROM account").get(),
		).toEqual({ provider_id: "github", account_id: "github-123" });
		expect(db.pragma("foreign_key_check")).toEqual([]);
		// A resource can be seeded and linked with the new compound constraint.
		db.exec(`
			INSERT INTO oauth_resource (id, identifier, name) VALUES ('resource1', 'https://sequence.example.com/api/mcp', 'Sequence');
			INSERT INTO oauth_client_resource (id, client_id, resource_id) VALUES ('link1', 'public-client', 'https://sequence.example.com/api/mcp');
		`);
		expect(() =>
			db.exec(
				"INSERT INTO oauth_client_resource (id, client_id, resource_id) VALUES ('link2', 'public-client', 'https://sequence.example.com/api/mcp')",
			),
		).toThrow(/UNIQUE/);
	} finally {
		db.close();
	}
});
