import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDatabase } from "@/lib/db";
import { type UserRow, users } from "@/lib/db/schema";
import type { Principal } from "./principal";

const COOKIE = "tm_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error(
      "SESSION_SECRET is not set. Copy .env.example to .env.local and fill it in.",
    );
  }
  return new TextEncoder().encode(value);
}

export async function startSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The signed-in User, or null. Agents never have a session cookie. */
export async function currentUser(): Promise<UserRow | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string") return null;

    const [row] = await getDatabase()
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    // An Agent holding a session cookie is a contradiction: refuse it. ADR 0002.
    return row && row.kind === "human" ? row : null;
  } catch {
    return null;
  }
}

export async function currentPrincipal(): Promise<Principal | null> {
  const user = await currentUser();
  return user ? { userId: user.id, kind: "human" } : null;
}
