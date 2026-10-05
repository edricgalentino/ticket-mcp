import { currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { type UserRow, users } from "@/lib/db/schema";
import type { Principal } from "./principal";

/**
 * The signed-in person, mirrored into our own `users` table.
 *
 * Clerk owns identity; this table owns the foreign keys that Tickets and
 * Transitions point at. The row is created on first sight rather than through
 * a webhook, which keeps the whole thing to one function at the cost of a
 * lookup per request.
 */
export async function currentUser(): Promise<UserRow | null> {
  const clerk = await clerkCurrentUser();
  if (!clerk) return null;

  const email = clerk.primaryEmailAddress?.emailAddress;
  if (!email) return null;

  const displayName =
    [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") ||
    clerk.username ||
    email;

  const db = getDatabase();
  const [row] = await db
    .insert(users)
    .values({ id: clerk.id, email, displayName })
    .onConflictDoUpdate({
      target: users.id,
      set: { email, displayName },
    })
    .returning();

  if (row) return row;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, clerk.id))
    .limit(1);
  return existing ?? null;
}

export async function currentPrincipal(): Promise<Principal | null> {
  const user = await currentUser();
  return user ? { userId: user.id, kind: "human" } : null;
}
