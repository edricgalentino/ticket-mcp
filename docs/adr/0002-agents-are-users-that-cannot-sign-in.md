# Agents are Users that cannot sign in

A Ticket can be created by a person through the browser or by an agent over MCP,
and both need to appear as the Ticket's reporter. Rather than make `reporter`
polymorphic over two principal types, an Agent is stored as an ordinary User row
that has no usable password and is rejected by the browser login path.

This keeps every reference to a person a plain foreign key, while still letting
you look at a Ticket list and see which entries an agent produced — which is the
thing that makes an MCP-fronted tracker interesting to watch in the first place.

## Considered Options

Mapping the agent's bearer token onto an existing human User was simpler still,
but it attributes agent work to a person who did not do it, and erases exactly
the distinction this project was built to observe.
