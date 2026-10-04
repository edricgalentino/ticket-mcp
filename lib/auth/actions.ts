"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDatabase } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { endSession, startSession } from "./session";

/**
 * A real hash to compare against when no account matches, so the failure path
 * does the same KDF work as the success path. It must be a genuine 60-character
 * bcrypt hash: a malformed string is length-checked and rejected in microseconds,
 * which is the timing oracle this is supposed to close.
 */
const ABSENT_USER_HASH = bcrypt.hashSync(crypto.randomUUID(), 10);

export async function signIn(
  _previous: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const [user] = await getDatabase()
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // One message for every failure: a distinct "no such user" would tell an
  // attacker which addresses exist.
  const invalid = { error: "Email or password is incorrect." };

  // ADR 0002: an Agent has no password hash, so it can never pass this.
  if (!user?.passwordHash || user.kind !== "human") {
    await bcrypt.compare(password, ABSENT_USER_HASH);
    return invalid;
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) return invalid;

  await startSession(user.id);
  redirect("/");
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/login");
}
