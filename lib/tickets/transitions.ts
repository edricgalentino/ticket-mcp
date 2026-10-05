/**
 * The Status values a Ticket can occupy, and the legal Transitions between
 * them. See CONTEXT.md for the vocabulary and ADR 0003 for why status changes
 * are funnelled through a single operation.
 */
export const STATUSES = ["Todo", "InProgress", "Done"] as const;

export type Status = (typeof STATUSES)[number];

/**
 * Linear, plus one backward edge so a finished Ticket can be reopened. The
 * cycle is deliberate: it is the case a naive implementation gets wrong.
 */
const LEGAL_TRANSITIONS: Record<Status, readonly Status[]> = {
  Todo: ["InProgress"],
  InProgress: ["Done"],
  Done: ["Todo"],
};

export function legalTransitionsFrom(status: Status): readonly Status[] {
  return LEGAL_TRANSITIONS[status];
}

export function isLegalTransition(from: Status, to: Status): boolean {
  return legalTransitionsFrom(from).includes(to);
}

export function isStatus(value: unknown): value is Status {
  return STATUSES.includes(value as Status);
}

/**
 * The Statuses a Ticket may legally be in to reach `to`. Derived from the same
 * table, so the two can never disagree.
 */
export function legalSourcesFor(to: Status): Status[] {
  return STATUSES.filter((from) => isLegalTransition(from, to));
}
