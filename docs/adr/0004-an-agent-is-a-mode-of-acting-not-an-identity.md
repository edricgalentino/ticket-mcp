# An Agent is a mode of acting, not an identity

Supersedes ADR 0002.

ADR 0002 made an Agent a User that cannot sign in, because the only Agent was
the server's own bearer token and it genuinely belonged to nobody. Moving
authentication to an OAuth authorization server changes that premise: a token
is now issued to a specific person's account, so an agent call is a person
acting through a tool, not an independent party.

So there is one User row per real person, and the *mode* they acted in is
recorded against the action instead of against the identity. A Ticket stores
who reported it and whether that was done directly or through an Agent; a
Transition does the same. The board can show that Edric moved a ticket and that
Edric's agent moved another, without pretending they are two people.

## Consequences

`kind` moves off the `users` table and onto the rows that describe actions.
Assignee deliberately has no mode: you are responsible for a Ticket as a
person, however the assignment happened to be made.

The honest cost is that a Principal is no longer a bare id. Anything that
attributes an action has to carry the mode with it, and dropping the mode on
the way through is now a silent bug rather than a type error. ADR 0001's
decision to pass a whole Principal rather than a user id is what makes this
affordable.
