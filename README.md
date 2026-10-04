# Ticket MCP

A ticket tracker with two faces: a web application for people, and an MCP
server for agents. Both go through one service layer.

It exists to learn how an MCP-fronted service works end to end. It is not a
replacement for anything, and it holds no real data.

- **[CONTEXT.md](./CONTEXT.md)** — the domain language. Read it first.
- **[docs/adr/](./docs/adr/)** — the three decisions worth not re-litigating.

## Running it

Requires Node >= 20.18.1 (`.nvmrc` pins 24).

```bash
nvm use
npm install
cp .env.example .env.local   # then fill in the two secrets it describes
npm run seed
npm run dev
```

Generate the two secrets with `openssl rand -base64 32` and
`openssl rand -hex 32`. `.env.local` is gitignored; nothing in it belongs in
a commit.

Sign in with a seeded account (`ana@ticket-mcp.local`) and the password in
`SEED_PASSWORD`. These are local development values only.

## Connecting an agent

Add to `.mcp.json`, with the token from `.env.local`:

```json
{
  "mcpServers": {
    "ticket-mcp": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${MCP_BEARER_TOKEN}" }
    }
  }
}
```

A static bearer token is scaffolding, not the destination — see
[ADR 0001](./docs/adr/0001-defer-mcp-oauth-behind-a-principal-seam.md).

### The tools

| Tool | Notes |
| --- | --- |
| `create_ticket` | Starts in `Todo`, reported by the calling principal |
| `get_ticket` | Returns the Ticket with its full Transition history |
| `list_tickets` | Filter by status, assignee, or both |
| `update_ticket` | Title, description, assignee. **Not status.** |
| `delete_ticket` | Takes the history with it |
| `transition_ticket` | The only way status changes. Refusals name the legal moves. |

Status moves `Todo → InProgress → Done → Todo`. Nothing else is legal, and
`update_ticket` refuses a `status` argument outright rather than ignoring it
([ADR 0003](./docs/adr/0003-status-changes-only-through-transition-ticket.md)).

## Checks

```bash
npm test          # 44 unit tests across the four agreed seams
npm run typecheck
npm run smoke     # drives the running server over HTTP, as an agent would
```

`npm run smoke` needs the dev server up and `MCP_BEARER_TOKEN` in the
environment.
