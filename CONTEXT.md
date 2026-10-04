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
An account that can sign in to the web application with an email address and a
password.
_Avoid_: Account, Member, Person

**Principal**:
Whoever is making a request: a User signed in through the browser, or an Agent
presenting a token. Distinct from User, because not every Principal is a person
and not every User is making a request.
_Avoid_: Caller, Identity, Actor, Subject

**Agent**:
An automated caller that reaches the system over MCP rather than through the
browser. An Agent is represented as a User that cannot sign in, so that work it
performs is attributable in the same way a person's is.
_Avoid_: Bot, Client, Integration, Service account

**Reporter**:
The User a Ticket is attributed to as its creator. May be an Agent.
_Avoid_: Creator, Author, Requester, Owner

**Assignee**:
The User currently responsible for a Ticket. May be an Agent, and may be unset.
_Avoid_: Owner, Responsible, Handler
