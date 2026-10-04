import { timingSafeEqual } from "node:crypto";

/**
 * Who is making a request. The web application resolves a Principal from a
 * session cookie; the MCP server resolves one from a bearer token. Both
 * converge on the Ticket service, which is where authorization belongs --
 * see docs/adr/0001-defer-mcp-oauth-behind-a-principal-seam.md.
 */
export interface Principal {
  userId: string;
  kind: "human" | "agent";
}

export interface PrincipalResolverConfig {
  /** The bearer token an MCP client must present. Empty disables MCP access. */
  token: string;
  /** The seeded Agent User the token stands for. See ADR 0002. */
  agentUserId: string;
}

/** Constant-time comparison, so a wrong token leaks nothing through timing. */
function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * THE SEAM. Today it reads a static bearer token. When MCP OAuth lands, this
 * is the one function that changes: everything downstream already speaks
 * Principal.
 */
export function createPrincipalResolver(config: PrincipalResolverConfig) {
  return function resolvePrincipal(request: Request): Principal | null {
    if (!config.token) return null;

    const header = request.headers.get("authorization");
    if (!header) return null;

    const [scheme, ...rest] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer") return null;

    const presented = rest.join(" ");
    if (!presented || !secretsMatch(presented, config.token)) return null;

    return { userId: config.agentUserId, kind: "agent" };
  };
}

export type PrincipalResolver = ReturnType<typeof createPrincipalResolver>;
