import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { applySchema } from "./migrate";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(file: string) {
  const connection = new BetterSqlite3(file);
  applySchema(connection);
  return drizzle(connection, { schema });
}

/** An isolated database per call, for tests. */
export function createInMemoryDatabase() {
  return createDatabase(":memory:");
}

declare global {
  // eslint-disable-next-line no-var
  var __ticketMcpDb: Database | undefined;
}

/** One connection per process, reused across hot reloads in development. */
export function getDatabase(): Database {
  globalThis.__ticketMcpDb ??= createDatabase(
    process.env.DATABASE_FILE ?? "ticket-mcp.db",
  );
  return globalThis.__ticketMcpDb;
}
