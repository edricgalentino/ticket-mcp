import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { DDL } from "./migrate";
import * as schema from "./schema";

/**
 * A real Postgres, in this process, per test. Production runs on Neon over
 * HTTP; the tests need the same dialect without the network, so the seams
 * stay fast enough to run on every change.
 */
export async function createTestDatabase() {
  const client = new PGlite();
  await client.exec(DDL);
  return drizzle(client, { schema });
}
