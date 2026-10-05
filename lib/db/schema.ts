import {
  index,
  bigserial,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { STATUSES } from "@/lib/tickets/transitions";

const MODES = ["human", "agent"] as const;

/**
 * A User is a person. One row per real person, keyed by their Clerk user id.
 * There is no password column and no kind: Clerk owns credentials, and how
 * someone acted is recorded against the action instead (ADR 0004).
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tickets = pgTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", { enum: STATUSES }).notNull().default("Todo"),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id),
    // How the reporter acted, not who they are. ADR 0004.
    reporterKind: text("reporter_kind", { enum: MODES })
      .notNull()
      .default("human"),
    assigneeId: text("assignee_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("tickets_status_idx").on(table.status),
    index("tickets_assignee_idx").on(table.assigneeId),
    index("tickets_created_idx").on(table.createdAt),
  ],
);

/**
 * A Transition is a recorded event, not a column write. Deleting a Ticket
 * takes its history with it.
 *
 * The key is a monotonic integer because history is ordered and two
 * Transitions can share a timestamp.
 */
export const transitions = pgTable(
  "transitions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    fromStatus: text("from_status", { enum: STATUSES }).notNull(),
    toStatus: text("to_status", { enum: STATUSES }).notNull(),
    note: text("note"),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    // How the actor acted. ADR 0004.
    actorKind: text("actor_kind", { enum: MODES }).notNull().default("human"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("transitions_ticket_idx").on(table.ticketId)],
);

export type Mode = (typeof MODES)[number];
export type UserRow = typeof users.$inferSelect;
export type TicketRow = typeof tickets.$inferSelect;
export type TransitionRow = typeof transitions.$inferSelect;
