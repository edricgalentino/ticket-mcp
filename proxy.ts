import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Next 16 calls this `proxy.ts`; it was `middleware.ts` before.
 *
 * The MCP endpoint and the OAuth discovery documents are deliberately public:
 * the endpoint does its own token check and must be able to answer 401 with a
 * pointer to the metadata, and the metadata has to be readable by a client
 * that has not authenticated yet. That is the whole discovery handshake.
 */
const isPublic = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/mcp(.*)",
  "/.well-known/(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublic(request)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
