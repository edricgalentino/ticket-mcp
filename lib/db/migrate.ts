/**
 * The schema as DDL. A learning project does not need a migration history, so
 * the tables are created on demand and the same statements serve the Neon
 * database and the in-process one the tests use.
 *
 * Timestamps are real `timestamptz` columns rather than strings. The SQLite
 * version stored ISO text in some paths and CURRENT_TIMESTAMP in others, which
 * put two formats in one column and made "newest first" undefined. A typed
 * column makes that class of bug impossible rather than merely fixed.
 */
export const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'Todo',
  reporter_id   TEXT NOT NULL REFERENCES users(id),
  reporter_kind TEXT NOT NULL DEFAULT 'human',
  assignee_id   TEXT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tickets_status_idx   ON tickets(status);
CREATE INDEX IF NOT EXISTS tickets_assignee_idx ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS tickets_created_idx  ON tickets(created_at);

CREATE TABLE IF NOT EXISTS transitions (
  id          BIGSERIAL PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status   TEXT NOT NULL,
  note        TEXT,
  actor_id    TEXT NOT NULL REFERENCES users(id),
  actor_kind  TEXT NOT NULL DEFAULT 'human',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transitions_ticket_idx ON transitions(ticket_id);
`;

/**
 * The DDL as individual statements. Neon's HTTP driver runs one statement per
 * request, so a multi-statement string fails to parse. PGlite accepts the
 * whole script at once, which is why the tests use `DDL` directly.
 */
export function ddlStatements(): string[] {
  return DDL.split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}
