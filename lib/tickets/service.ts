import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { Principal } from "@/lib/auth/principal";
import type { Database } from "@/lib/db";
import { tickets, transitions } from "@/lib/db/schema";
import type { TicketRow, TransitionRow } from "@/lib/db/schema";
import { type Status, isLegalTransition, legalTransitionsFrom } from "./transitions";

export class TicketNotFoundError extends Error {
  constructor(readonly ticketId: string) {
    super(`No Ticket with id ${ticketId}`);
    this.name = "TicketNotFoundError";
  }
}

/**
 * Carries the legal Transitions so a caller is told what it *could* have done,
 * not merely that it was wrong.
 */
export class IllegalTransitionError extends Error {
  constructor(
    readonly from: Status,
    readonly to: Status,
    readonly legalTransitions: readonly Status[],
  ) {
    super(
      `Cannot transition a Ticket from ${from} to ${to}. ` +
        `Legal transitions from ${from}: ${legalTransitions.join(", ") || "none"}.`,
    );
    this.name = "IllegalTransitionError";
  }
}

export interface CreateTicketInput {
  title: string;
  description?: string;
  assigneeId?: string | null;
}

/** A Ticket together with the Transitions it has been through, oldest first. */
export interface TicketWithHistory extends TicketRow {
  history: TransitionRow[];
}

/**
 * Deliberately has no `status`: see
 * docs/adr/0003-status-changes-only-through-transition-ticket.md.
 */
export interface UpdateTicketInput {
  ticketId: string;
  title?: string;
  description?: string;
  assigneeId?: string | null;
}

export interface ListTicketsFilter {
  status?: Status;
  /** `null` matches Tickets nobody is assigned to. */
  assigneeId?: string | null;
}

export interface TransitionTicketInput {
  ticketId: string;
  to: Status;
  note?: string | null;
}

export function createTicketService(db: Database) {
  async function requireTicket(ticketId: string): Promise<TicketRow> {
    const [row] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);
    if (!row) throw new TicketNotFoundError(ticketId);
    return row;
  }

  return {
    async getTicket(ticketId: string): Promise<TicketWithHistory> {
      const ticket = await requireTicket(ticketId);
      const history = await db
        .select()
        .from(transitions)
        .where(eq(transitions.ticketId, ticketId))
        .orderBy(asc(transitions.id));
      return { ...ticket, history };
    },

    async createTicket(
      actor: Principal,
      input: CreateTicketInput,
    ): Promise<TicketRow> {
      // Written explicitly rather than left to the DDL's CURRENT_TIMESTAMP,
      // which has second precision and a different string format. One shape
      // per column, and enough precision for "newest first" to mean something.
      const now = new Date().toISOString();
      const [row] = await db
        .insert(tickets)
        .values({
          id: crypto.randomUUID(),
          title: input.title,
          description: input.description ?? "",
          status: "Todo",
          reporterId: actor.userId,
          reporterKind: actor.kind,
          assigneeId: input.assigneeId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return row;
    },

    async listTickets(filter: ListTicketsFilter = {}): Promise<TicketRow[]> {
      const conditions = [];
      if (filter.status !== undefined) {
        conditions.push(eq(tickets.status, filter.status));
      }
      if (filter.assigneeId !== undefined) {
        conditions.push(
          filter.assigneeId === null
            ? isNull(tickets.assigneeId)
            : eq(tickets.assigneeId, filter.assigneeId),
        );
      }

      const query = db.select().from(tickets);
      return (
        conditions.length ? query.where(and(...conditions)) : query
      ).orderBy(desc(tickets.createdAt), desc(tickets.id));
    },

    async deleteTicket(_actor: Principal, ticketId: string): Promise<void> {
      await requireTicket(ticketId);
      await db.delete(tickets).where(eq(tickets.id, ticketId));
    },

    async updateTicket(
      _actor: Principal,
      input: UpdateTicketInput,
    ): Promise<TicketRow> {
      await requireTicket(input.ticketId);

      // Built field by field rather than spread, so that a `status` arriving
      // on an untyped payload cannot reach the column. ADR 0003.
      const patch: Partial<TicketRow> = { updatedAt: new Date().toISOString() };
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId;

      const [row] = await db
        .update(tickets)
        .set(patch)
        .where(eq(tickets.id, input.ticketId))
        .returning();
      return row;
    },

    async transitionTicket(
      actor: Principal,
      input: TransitionTicketInput,
    ): Promise<TicketRow> {
      // The read, the legality check and both writes are one transaction, so
      // two concurrent transitions cannot both pass the check and leave the
      // history disagreeing with the Ticket's status.
      return db.transaction((tx) => {
        const [ticket] = tx
          .select()
          .from(tickets)
          .where(eq(tickets.id, input.ticketId))
          .limit(1)
          .all();
        if (!ticket) throw new TicketNotFoundError(input.ticketId);

        const from = ticket.status;
        if (!isLegalTransition(from, input.to)) {
          throw new IllegalTransitionError(
            from,
            input.to,
            legalTransitionsFrom(from),
          );
        }

        // One timestamp for both rows: they describe the same event.
        const now = new Date().toISOString();

        const [updated] = tx
          .update(tickets)
          .set({ status: input.to, updatedAt: now })
          .where(eq(tickets.id, ticket.id))
          .returning()
          .all();

        tx.insert(transitions)
          .values({
            ticketId: ticket.id,
            fromStatus: from,
            toStatus: input.to,
            note: input.note ?? null,
            actorId: actor.userId,
            actorKind: actor.kind,
            createdAt: now,
          })
          .run();

        return updated;
      });
    },
  };
}

export type TicketService = ReturnType<typeof createTicketService>;
