import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { currentUser } from "@/lib/auth/current-user";
import { getDatabase } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createTicketAction } from "@/lib/tickets/actions";
import { createTicketService } from "@/lib/tickets/service";
import { Actor } from "./_components/actor";
import { StatusBadge } from "./_components/status-badge";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const me = await currentUser();
  if (!me) redirect("/sign-in");

  const db = getDatabase();
  const [tickets, everyone] = await Promise.all([
    createTicketService(db).listTickets(),
    db.select().from(users),
  ]);
  const byId = new Map(everyone.map((u) => [u.id, u]));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Signed in as {me.displayName}
          </p>
        </div>
        <SignOutButton>
          <button
            type="button"
            className="text-sm text-neutral-500 underline-offset-4 hover:underline"
          >
            Sign out
          </button>
        </SignOutButton>
      </header>

      <form
        action={createTicketAction}
        className="mt-8 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            name="title"
            required
            placeholder="What needs doing?"
            className="flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300"
          />
          <select
            name="assigneeId"
            defaultValue=""
            aria-label="Assignee"
            className="rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
          >
            <option value="">Unassigned</option>
            {everyone.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            Create
          </button>
        </div>
      </form>

      <ul className="mt-6 divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
        {tickets.length === 0 ? (
          <li className="p-6 text-center text-sm text-neutral-500">
            No tickets yet.
          </li>
        ) : null}

        {tickets.map((ticket) => {
          const reporter = byId.get(ticket.reporterId);
          const assignee = ticket.assigneeId
            ? byId.get(ticket.assigneeId)
            : null;
          return (
            <li key={ticket.id}>
              <Link
                href={`/tickets/${ticket.id}`}
                className="flex items-center gap-3 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <StatusBadge status={ticket.status} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {ticket.title}
                </span>
                <span className="shrink-0 text-xs text-neutral-500">
                  <Actor
                    name={reporter?.displayName ?? "unknown"}
                    kind={ticket.reporterKind}
                  />
                  {assignee ? ` → ${assignee.displayName}` : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
