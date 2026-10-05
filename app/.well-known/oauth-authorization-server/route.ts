import {
  authServerMetadataHandlerClerk,
  metadataCorsOptionsRequestHandler,
} from "@clerk/mcp-tools/next";

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414), mirrored from Clerk so
 * clients that look for it on the resource server's origin still find it.
 */
const handler = authServerMetadataHandlerClerk();

const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
