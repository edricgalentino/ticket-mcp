/**
 * Applies the schema to whatever DATABASE_URL points at. A learning project
 * does not need a migration history; this is idempotent.
 */
import { sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { ddlStatements } from "@/lib/db/migrate";

async function main() {
  const db = getDatabase();
  for (const statement of ddlStatements()) {
    await db.execute(sql.raw(statement));
  }

  const tables = await db.execute(
    sql`SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name`,
  );
  console.log(
    "tables:",
    (tables.rows as { table_name: string }[])
      .map((r) => r.table_name)
      .join(", "),
  );

  console.log("schema applied");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
