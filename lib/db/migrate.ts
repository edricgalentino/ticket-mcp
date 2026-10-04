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
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS transitions_ticket_idx ON transitions(ticket_id);
`;

export function applySchema(connection: BetterSqlite3.Database): void {
  connection.pragma("foreign_keys = ON");
  connection.exec(DDL);
}
