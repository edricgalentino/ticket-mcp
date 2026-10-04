import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Principal } from "@/lib/auth/principal";
import type { TicketTool } from "./tools";

export const SERVER_INFO = {
  name: "ticket-mcp",
  version: "0.1.0",
} as const;

/**
 * A Server bound to one Principal. In stateless mode a fresh one is built per
 * request, so the Principal never has to be threaded through the transport.
 */
export function createMcpServer(tools: TicketTool[], principal: Principal) {
  const server = new Server(SERVER_INFO, {
    capabilities: { tools: {} },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: z.toJSONSchema(tool.schema) as Record<string, unknown>,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        content: [
          {
            type: "text" as const,
            text:
              `No tool named ${request.params.name}. Available: ` +
              tools.map((t) => t.name).join(", "),
          },
        ],
        isError: true,
      };
    }
    return tool.handler(request.params.arguments, principal);
  });

  return server;
}
