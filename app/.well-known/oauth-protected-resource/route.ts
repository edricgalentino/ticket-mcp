import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandlerClerk,
} from "@clerk/mcp-tools/next";

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 *
 * The MCP spec makes this mandatory: it is how a client discovers which
 * authorization server to talk to. Ours points at Clerk.
 */
const handler = protectedResourceHandlerClerk({
  scopes_supported: ["profile", "email"],
});

const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
