import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Principal } from "@/lib/auth/principal";
import type { Database } from "@/lib/db";
import { tickets, transitions } from "@/lib/db/schema";
import type { TicketRow, TransitionRow } from "@/lib/db/schema";
import {
  type Status,
  legalSourcesFor,
  legalTransitionsFrom,
} from "./transitions";

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

/** `db.execute` returns raw rows, so the column names need mapping back. */
function toTicketRow(row: Record<string, unknown>): TicketRow {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    status: row.status as Status,
    reporterId: row.reporter_id as string,
    reporterKind: row.reporter_kind as TicketRow["reporterKind"],
    assigneeId: (row.assignee_id as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
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
      const now = new Date();
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
      const patch: Partial<TicketRow> = { updatedAt: new Date() };
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
      const sources = legalSourcesFor(input.to);
      const sourceList = sql.join(
        sources.map((status) => sql`${status}`),
        sql`, `,
      );

      // One statement, so the check and both writes cannot come apart.
      // `target` reads the current Status; the UPDATE only fires when that
      // Status may legally reach `to`; the INSERT selects from the UPDATE's
      // result. So no history row can describe a move that did not happen,
      // and no move can happen without one. This stands in for an interactive
      // transaction, which Neon's HTTP driver does not support.
      //
      // The from_status recorded is the one actually read, not an assumption
      // about which source was legal -- that matters the moment any Status has
      // more than one legal predecessor.
      const moved = await db.execute(sql`
        WITH target AS (
          SELECT id, status FROM tickets WHERE id = ${input.ticketId} FOR UPDATE
        ), moved AS (
          UPDATE tickets
             SET status = ${input.to}, updated_at = NOW()
            FROM target
           WHERE tickets.id = target.id
             AND target.status IN (${sourceList})
          RETURNING tickets.*, target.status AS from_status
        ), logged AS (
          INSERT INTO transitions
            (ticket_id, from_status, to_status, note, actor_id, actor_kind)
          SELECT id, from_status, ${input.to}, ${input.note ?? null},
                 ${actor.userId}, ${actor.kind}
            FROM moved
          RETURNING id
        )
        SELECT * FROM moved
      `);

      const row = (moved.rows as Record<string, unknown>[])[0];
      if (row) return toTicketRow(row);

      // Nothing moved. Work out which of the two reasons it was.
      const ticket = await requireTicket(input.ticketId);
      throw new IllegalTransitionError(
        ticket.status,
        input.to,
        legalTransitionsFrom(ticket.status),
      );
    },
  };
}

export type TicketService = ReturnType<typeof createTicketService>;
