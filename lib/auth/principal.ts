import { clerkClient } from "@clerk/nextjs/server";

/**
 * Who is making a request, and in which mode. A User signed in through the
 * browser acts as "human"; the same person's agent, calling over MCP with an
 * OAuth access token, acts as "agent". See ADR 0004.
 */
export interface Principal {
  userId: string;
  kind: "human" | "agent";
}

/**
 * THE SEAM (ADR 0001). It used to compare a static bearer token; it now
 * verifies an OAuth access token issued by Clerk. Nothing downstream changed:
 * the service layer and all six tools still just receive a Principal.
 */
export async function resolveAgentPrincipal(
  request: Request,
): Promise<Principal | null> {
  const client = await clerkClient();
  const result = await client.authenticateRequest(request, {
    acceptsToken: "oauth_token",
  });

  if (!result.isAuthenticated) return null;

  const userId = result.toAuth()?.userId;
  return userId ? { userId, kind: "agent" } : null;
}
