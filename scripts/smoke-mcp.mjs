/**
 * Drives the MCP endpoint the way an agent would: initialize, list the tools,
 * then exercise the two rules that matter (illegal transitions are refused
 * with the legal ones named, and update_ticket will not take a status).
 *
 * Usage: node scripts/smoke-mcp.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";
const TOKEN = process.env.MCP_BEARER_TOKEN;
if (!TOKEN) {
  console.error("MCP_BEARER_TOKEN is not set. Source .env.local first.");
  process.exit(1);
}

let id = 0;
async function rpc(method, params, token = TOKEN) {
  const response = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  if (!response.ok) return { httpStatus: response.status };
  return response.json();
}

const callTool = async (name, args) => {
  const { result } = await rpc("tools/call", { name, arguments: args });
  const text = result.content[0]?.text ?? "";
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return { isError: result.isError === true, text, data };
};

const checks = [];
const check = (label, pass, detail = "") =>
  checks.push({ label, pass, detail });

const noAuth = await rpc("initialize", {}, null);
check("rejects a request with no token", noAuth.httpStatus === 401);

const init = await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "smoke", version: "0" },
});
check("completes the handshake", init.result?.serverInfo?.name === "ticket-mcp");

const { result: list } = await rpc("tools/list", {});
check("advertises six tools", list.tools.length === 6, list.tools.map((t) => t.name).join(", "));

const created = await callTool("create_ticket", {
  title: "Created by an agent over MCP",
  description: "Proving the round trip.",
});
check("creates a ticket", !created.isError && !!created.data?.id);
check("attributes it to the Agent", created.data?.reporterId === "u-agent", `reporterId=${created.data?.reporterId}`);
const ticketId = created.data.id;

const illegal = await callTool("transition_ticket", { ticketId, to: "Done" });
check("refuses Todo -> Done", illegal.isError);
check("names the legal transition in the refusal", illegal.text.includes("InProgress"), illegal.text);

const legal = await callTool("transition_ticket", {
  ticketId,
  to: "InProgress",
  note: "agent picked this up",
});
check("allows Todo -> InProgress", !legal.isError && legal.data?.status === "InProgress");

const smuggled = await callTool("update_ticket", {
  ticketId,
  title: "Renamed by the agent",
  status: "Done",
});
check("refuses a smuggled status outright", smuggled.isError, smuggled.text);

const after = await callTool("get_ticket", { ticketId });
check("status survived the smuggling attempt", after.data?.status === "InProgress", `status=${after.data?.status}`);
check("title was not changed either, since the call was refused", after.data?.title === "Created by an agent over MCP");
check("records the transition with its note", after.data?.history?.[0]?.note === "agent picked this up");

const rename = await callTool("update_ticket", { ticketId, title: "Renamed by the agent" });
check("accepts a clean update", !rename.isError && rename.data?.title === "Renamed by the agent");

const listed = await callTool("list_tickets", { status: "InProgress" });
check("filters by status", Array.isArray(listed.data) && listed.data.some((t) => t.id === ticketId));

let failures = 0;
for (const { label, pass, detail } of checks) {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail && !pass ? `\n        ${detail}` : ""}`);
}
console.log(`\n${checks.length - failures}/${checks.length} passed`);
process.exit(failures === 0 ? 0 : 1);
