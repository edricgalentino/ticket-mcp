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

const DEV_PASSWORD = process.env.SEED_PASSWORD ?? "devpassword";
const AGENT_EMAIL = process.env.MCP_AGENT_EMAIL ?? "agent@ticket-mcp.local";

async function main() {
  const db = createDatabase(process.env.DATABASE_FILE ?? "ticket-mcp.db");
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const people = [
    { id: "u-ana", email: "ana@ticket-mcp.local", displayName: "Ana" },
    { id: "u-bo", email: "bo@ticket-mcp.local", displayName: "Bo" },
  ];

  for (const person of people) {
    await db
      .insert(users)
      .values({ ...person, kind: "human", passwordHash })
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
  for (const person of people) console.log(`  ${person.email}`);
  console.log(`  ${AGENT_EMAIL} (agent, cannot sign in)`);
  console.log(
    `\nSign in with the password in SEED_PASSWORD (default: "${DEV_PASSWORD}").`,
  );
  console.log("Development only. Do not reuse this password anywhere real.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
