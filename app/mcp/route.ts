import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { eq } from "drizzle-orm";
import { createPrincipalResolver } from "@/lib/auth/principal";
import { getDatabase } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createMcpServer } from "@/lib/mcp/server";
import { createTicketTools } from "@/lib/mcp/tools";
import { createTicketService } from "@/lib/tickets/service";

export const dynamic = "force-dynamic";

const unauthorized = () =>
  Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: present a bearer token." },
      id: null,
    },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="ticket-mcp"' } },
  );

const misconfigured = () =>
  Response.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message:
          "Server misconfigured: MCP_AGENT_EMAIL is unset, or no Agent row " +
          "matches it. Run `npm run seed`.",
      },
      id: null,
    },
    { status: 500 },
  );

async function agentUserId(): Promise<string | null> {
  const email = process.env.MCP_AGENT_EMAIL;
  if (!email) return null;
  const [row] = await getDatabase()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row?.id ?? null;
}

export async function POST(request: Request): Promise<Response> {
  const token = process.env.MCP_BEARER_TOKEN ?? "";
  if (!token) return unauthorized();

  // The token is checked before the database is touched, so an unauthenticated
  // request costs no query. The Agent id is a placeholder until it resolves.
  if (!createPrincipalResolver({ token, agentUserId: "" })(request)) {
    return unauthorized();
  }

  // The token was good, so a failure past this point is the server's fault,
  // not the caller's. Saying 401 here would tell a correctly-configured client
  // that its token is wrong.
  const userId = await agentUserId();
  if (!userId) return misconfigured();
  const principal = { userId, kind: "agent" as const };

  const tools = createTicketTools(createTicketService(getDatabase()));
  const server = createMcpServer(tools, principal);

  // Stateless: one transport per request, no session to keep.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await transport.close();
  }
}

/** Stateless mode keeps no stream to resume and no session to delete. */
export function GET(): Response {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST" },
  });
}

export const DELETE = GET;
