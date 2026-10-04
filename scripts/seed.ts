/**
 * Seeds a development database: two people, one Agent, and a few Tickets.
 *
 * Passwords here are development-only values for a localhost database. They
 * are not secrets, must never be reused anywhere real, and this script is not
 * meant to run against a deployed environment.
 */
import bcrypt from "bcryptjs";
import { createDatabase } from "@/lib/db";
import { tickets, users } from "@/lib/db/schema";

const DEFAULT_DEV_PASSWORD = "devpassword";
const DEV_PASSWORD = process.env.SEED_PASSWORD ?? DEFAULT_DEV_PASSWORD;
const PASSWORD_CAME_FROM_ENV = process.env.SEED_PASSWORD !== undefined;
const AGENT_EMAIL = process.env.MCP_AGENT_EMAIL ?? "agent@ticket-mcp.local";

async function main() {
  const db = createDatabase(process.env.DATABASE_FILE ?? "ticket-mcp.db");
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const humans = [
    { id: "u-ana", email: "ana@ticket-mcp.local", displayName: "Ana" },
    { id: "u-bo", email: "bo@ticket-mcp.local", displayName: "Bo" },
  ];

  for (const human of humans) {
    await db
      .insert(users)
      .values({ ...human, kind: "human", passwordHash })
      .onConflictDoNothing();
  }

  // The Agent: a User with no password, so the login path can never accept it.
  await db
    .insert(users)
    .values({
      id: "u-agent",
      email: AGENT_EMAIL,
      displayName: "Claude",
      kind: "agent",
      passwordHash: null,
    })
    .onConflictDoNothing();

  const samples = [
    { title: "Wire the MCP route handler", assigneeId: "u-ana" },
    { title: "Write the ticket list page", assigneeId: "u-bo" },
    { title: "Decide what to do about OAuth", assigneeId: null },
  ];

  for (const sample of samples) {
    await db
      .insert(tickets)
      .values({
        id: crypto.randomUUID(),
        title: sample.title,
        description: "",
        status: "Todo",
        reporterId: "u-ana",
        assigneeId: sample.assigneeId,
      })
      .onConflictDoNothing();
  }

  console.log("Seeded:");
  for (const human of humans) console.log(`  ${human.email}`);
  console.log(`  ${AGENT_EMAIL} (agent, cannot sign in)`);
  // Only the hardcoded default is ever printed. A value supplied through the
  // environment is the caller's to know, and must not land in a terminal or CI log.
  console.log(
    PASSWORD_CAME_FROM_ENV
      ? "\nSign in with the password you passed in SEED_PASSWORD."
      : `\nSign in with the default development password: "${DEFAULT_DEV_PASSWORD}".`,
  );
  console.log("Development only. Do not reuse this password anywhere real.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
