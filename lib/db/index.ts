import net from "node:net";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Neon's hostname resolves to several addresses, and on some networks one of
 * them is a black hole. Node's happy-eyeballs gives that address the full
 * default window before trying the next, which surfaces as an intermittent
 * ETIMEDOUT even though the other addresses answer in about 250ms. A short
 * attempt timeout makes it move on. Set here rather than via NODE_OPTIONS so
 * that `next dev`, the scripts and the tests all get it.
 */
net.setDefaultAutoSelectFamilyAttemptTimeout(300);

import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

/**
 * Neon in production, PGlite in tests. Both are Drizzle Postgres databases and
 * the service only uses what they share.
 */
export type Database =
  | NeonHttpDatabase<typeof schema>
  | PgliteDatabase<typeof schema>;

/**
 * The HTTP driver. It has no transactions -- `drizzle-orm/neon-http` throws
 * "No transactions support in neon-http driver" -- which is fine here because
 * nothing needs one: the only read-check-write in the system is
 * transitionTicket, and that is a single guarded statement. See
 * lib/tickets/service.ts.
 *
 * The WebSocket driver would give transactions but could not connect from
 * here at all (ETIMEDOUT, while plain HTTPS to the same host answered).
 */
let cached: Database | null = null;

export function getDatabase(): Database {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Run `vercel env pull` to fetch it.",
      );
    }
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}
