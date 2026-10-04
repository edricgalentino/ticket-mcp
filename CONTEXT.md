# Ticket MCP

A learning project: a ticket-tracking web application that also exposes its
operations to AI agents over the Model Context Protocol. Built to understand how
an MCP-fronted service works end to end, not to replace or clone any existing
tracker.

## Language

**Ticket**:
The unit of work tracked in the system. The central entity: everything else in
the domain exists to describe, contain, or move a Ticket.
_Avoid_: Issue, Work Item, Task, Card

**Status**:
A named state a Ticket occupies. A Ticket is in exactly one Status at a time.
_Avoid_: State, Stage, Column, Phase

**Transition**:
A recorded move of a Ticket from one Status to another, optionally carrying a
note. Not every pair of Statuses forms a legal Transition; the set of legal ones
is fixed and enforced. Transitions accumulate: a Ticket has a history of them.
_Avoid_: Move, Change, Update, Status change

**User**:
A person with an account. One row per real person, whether they are acting
through the web application or through an Agent.
_Avoid_: Account, Member, Person

**Principal**:
Who is making a request and in which mode: a User, plus whether they are acting
as themselves or as an Agent. Distinct from User, because a User is a standing
fact and a Principal is a property of one request.
_Avoid_: Caller, Identity, Actor, Subject

**Agent**:
A User acting through an automated tool over MCP rather than through the
browser. Agent is a *mode of acting*, not an identity: the same person is one
User whether they click a button or their agent calls a tool. Which mode was
used is recorded alongside the action.
_Avoid_: Bot, Client, Integration, Service account

**Reporter**:
The User a Ticket is attributed to as its creator, together with the mode they
created it in.
_Avoid_: Creator, Author, Requester, Owner

**Assignee**:
The User currently responsible for a Ticket. May be unset. Has no mode: being
responsible for something is not an act.
_Avoid_: Owner, Responsible, Handler
