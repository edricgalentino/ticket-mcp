# Defer MCP OAuth, behind a principal seam

The MCP server authenticates agents with a single static bearer token read from
the environment, not with the OAuth flow the MCP specification describes. OAuth
is still the intended destination — reproducing the "log in with your Mekari
account to connect your agent" experience is one of the things this project
exists to learn — but building it first would have meant fighting an
authorization server before any ticket existed.

So the token is scaffolding, and it is kept behind a `resolvePrincipal(request)`
seam with exactly one implementation today. A future reader will see a
single-implementation indirection and reasonably assume it is over-engineering:
it is not. It is the swap point for OAuth, and it is deliberate.

## Consequences

The web application and the MCP server authenticate by entirely different means
(email/password session vs. bearer token) and converge on one service layer.
Authorization therefore belongs in the service layer, not in either entry point,
because neither entry point sees both kinds of caller.
