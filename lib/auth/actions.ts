"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDatabase } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { endSession, startSession } from "./session";

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
    await bcrypt.compare(password, "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidine");
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
