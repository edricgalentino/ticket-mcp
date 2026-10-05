import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Clerk is an external boundary, so it is mocked here; everything inside the
 * seam -- deciding whether a request yields a Principal, and in which mode --
 * is this project's own and is what these tests cover. See ADR 0001.
 */
const authenticateRequest = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ authenticateRequest }),
}));

const { resolveAgentPrincipal } = await import("./principal");

const request = () => new Request("https://example.test/mcp");

beforeEach(() => authenticateRequest.mockReset());

describe("resolveAgentPrincipal", () => {
  it("resolves an authenticated token to an Agent principal", async () => {
    authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({ userId: "user_abc" }),
    });

    expect(await resolveAgentPrincipal(request())).toEqual({
      userId: "user_abc",
      kind: "agent",
    });
  });

  it("refuses a request Clerk did not authenticate", async () => {
    authenticateRequest.mockResolvedValue({
      isAuthenticated: false,
      toAuth: () => null,
    });

    expect(await resolveAgentPrincipal(request())).toBeNull();
  });

  // Authenticated but anonymous would otherwise produce a Principal with an
  // empty userId, which every foreign key downstream would then reject.
  it("refuses an authenticated request that carries no user", async () => {
    authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => null,
    });

    expect(await resolveAgentPrincipal(request())).toBeNull();
  });

  it("asks Clerk for an OAuth token specifically, not a session cookie", async () => {
    authenticateRequest.mockResolvedValue({
      isAuthenticated: false,
      toAuth: () => null,
    });

    await resolveAgentPrincipal(request());

    expect(authenticateRequest).toHaveBeenCalledWith(expect.any(Request), {
      acceptsToken: "oauth_token",
    });
  });
});
