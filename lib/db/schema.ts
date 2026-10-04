import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { STATUSES } from "@/lib/tickets/transitions";

/**
 * A User is a sign-in identity. An Agent is a User that cannot sign in: see
 * docs/adr/0002-agents-are-users-that-cannot-sign-in.md. Agents are
 * distinguished by `kind`, and carry no password hash at all.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  kind: text("kind", { enum: ["human", "agent"] })
    .notNull()
    .default("human"),
  passwordHash: text("password_hash"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", { enum: STATUSES }).notNull().default("Todo"),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id),
    assigneeId: text("assignee_id").references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("tickets_status_idx").on(table.status),
    index("tickets_assignee_idx").on(table.assigneeId),
  ],
);

/**
 * A Transition is a recorded event, not a column write. Deleting a Ticket
 * takes its history with it.
 *
 * The key is a monotonic integer rather than a UUID: history is ordered, and
 * CURRENT_TIMESTAMP only has second precision, so several Transitions recorded
 * in the same second would otherwise have no defined order.
 */
export const transitions = sqliteTable(
  "transitions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    fromStatus: text("from_status", { enum: STATUSES }).notNull(),
    toStatus: text("to_status", { enum: STATUSES }).notNull(),
    note: text("note"),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("transitions_ticket_idx").on(table.ticketId)],
);

export type UserRow = typeof users.$inferSelect;
export type TicketRow = typeof tickets.$inferSelect;
export type TransitionRow = typeof transitions.$inferSelect;
