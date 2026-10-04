# Status changes only through transition_ticket

`update_ticket` can change a Ticket's title, description and assignee, but not
its status. Status moves exclusively through `transition_ticket`, which checks
the move against the set of legal Transitions and records it in the Ticket's
history with an optional note.

A future reader will notice that the obvious thing — letting `update_ticket`
set any field — is deliberately not done, and may try to "fix" it. The reason is
that a general-purpose update would be a second, unchecked path to the same
state change, bypassing both the legality check and the history record. The
narrower tool is the one that makes the state machine real rather than
decorative.
