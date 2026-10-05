import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolveAgentPrincipal } from "@/lib/auth/principal";
import { getDatabase } from "@/lib/db";
import { createMcpServer } from "@/lib/mcp/server";
import { createTicketTools } from "@/lib/mcp/tools";
import { createTicketService } from "@/lib/tickets/service";

export const dynamic = "force-dynamic";

/**
 * The spec requires the challenge to carry `resource_metadata` pointing at the
 * protected resource document -- that pointer is how an unauthenticated client
 * discovers where to authenticate. A bare `realm` tells it nothing.
 */
function unauthorized(request: Request): Response {
  const metadataUrl = new URL(
    "/.well-known/oauth-protected-resource",
    request.url,
  ).toString();

  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl}"`,
      },
    },
  );
}

export async function POST(request: Request): Promise<Response> {
  const principal = await resolveAgentPrincipal(request);
  if (!principal) return unauthorized(request);

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
