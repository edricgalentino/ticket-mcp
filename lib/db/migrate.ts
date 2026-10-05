import type BetterSqlite3 from "better-sqlite3";

/**
 * The schema as DDL. A learning project does not need a migration history, so
 * the tables are created on demand and the same statements serve both the dev
 * database and the in-memory one the tests use.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'human',
  password_hash TEXT,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'Todo',
  reporter_id TEXT NOT NULL REFERENCES users(id),
  reporter_kind TEXT NOT NULL DEFAULT 'human',
  assignee_id TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS tickets_status_idx   ON tickets(status);
CREATE INDEX IF NOT EXISTS tickets_assignee_idx ON tickets(assignee_id);

CREATE TABLE IF NOT EXISTS transitions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status   TEXT NOT NULL,
  note        TEXT,
  actor_id    TEXT NOT NULL REFERENCES users(id),
  actor_kind  TEXT NOT NULL DEFAULT 'human',
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS transitions_ticket_idx ON transitions(ticket_id);
`;

/**
 * Columns added after the first release. CREATE TABLE IF NOT EXISTS does not
 * alter an existing table, so a database made before a column existed would
 * otherwise break on the next query. Checked rather than attempted, because a
 * duplicate ALTER is an error in SQLite.
 */
const ADDED_COLUMNS: {
  table: string;
  column: string;
  ddl: string;
  /**
   * Run once, immediately after the column is added. The DEFAULT applies to
   * every existing row, which is wrong for rows that were an Agent's work, so
   * the mode is recovered from the identity that took the action. This is only
   * possible while users.kind still exists -- once identities stop carrying a
   * kind, the history is unrecoverable.
   */
  backfill?: string;
}[] = [
  {
    table: "tickets",
    column: "reporter_kind",
    ddl: "ALTER TABLE tickets ADD COLUMN reporter_kind TEXT NOT NULL DEFAULT 'human'",
    backfill: `UPDATE tickets SET reporter_kind = 'agent'
               WHERE reporter_id IN (SELECT id FROM users WHERE kind = 'agent')`,
  },
  {
    table: "transitions",
    column: "actor_kind",
    ddl: "ALTER TABLE transitions ADD COLUMN actor_kind TEXT NOT NULL DEFAULT 'human'",
    backfill: `UPDATE transitions SET actor_kind = 'agent'
               WHERE actor_id IN (SELECT id FROM users WHERE kind = 'agent')`,
  },
];

export function applySchema(connection: BetterSqlite3.Database): void {
  connection.pragma("foreign_keys = ON");
  connection.exec(DDL);

  for (const { table, column, ddl, backfill } of ADDED_COLUMNS) {
    const columns = connection.pragma(`table_info(${table})`) as {
      name: string;
    }[];
    if (columns.some((c) => c.name === column)) continue;
    connection.exec(ddl);
    if (backfill) connection.exec(backfill);
  }
}
