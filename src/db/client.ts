import { drizzle } from "drizzle-orm/d1";
import * as schema from "#/db/schema/index";

export function createDatabaseClient(db: D1Database) {
	return drizzle(db, { schema });
}

export type DBClient = ReturnType<typeof createDatabaseClient>;
export type DBTx = DBClient['transaction'];
