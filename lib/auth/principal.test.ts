import { describe, expect, it } from "vitest";
import { createPrincipalResolver } from "./principal";

const TOKEN = "test-token-not-a-real-secret";
const resolve = createPrincipalResolver({
  token: TOKEN,
  agentUserId: "u-agent",
});

function request(authorization?: string): Request {
  return new Request("http://localhost/mcp", {
    headers: authorization ? { authorization } : {},
  });
}

describe("resolvePrincipal", () => {
  it("resolves a valid bearer token to the Agent principal", () => {
    expect(resolve(request(`Bearer ${TOKEN}`))).toEqual({
      userId: "u-agent",
      kind: "agent",
    });
  });

  it("accepts the scheme case-insensitively, as RFC 7235 requires", () => {
    expect(resolve(request(`bearer ${TOKEN}`))).not.toBeNull();
  });

  it("rejects a request with no Authorization header", () => {
    expect(resolve(request())).toBeNull();
  });

  it("rejects the wrong token", () => {
    expect(resolve(request("Bearer not-the-token"))).toBeNull();
  });

  it("rejects a token of the right length but wrong content", () => {
    expect(resolve(request(`Bearer ${"x".repeat(TOKEN.length)}`))).toBeNull();
  });

  it("rejects a bare token with no scheme", () => {
    expect(resolve(request(TOKEN))).toBeNull();
  });

  it("rejects another scheme carrying the right value", () => {
    expect(resolve(request(`Basic ${TOKEN}`))).toBeNull();
  });

  it("refuses to authenticate anyone when no token is configured", () => {
    const unconfigured = createPrincipalResolver({
      token: "",
      agentUserId: "u-agent",
    });
    expect(unconfigured(request("Bearer "))).toBeNull();
    expect(unconfigured(request())).toBeNull();
  });
});
