import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getDatabase } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  deleteTicketAction,
  transitionTicketAction,
  updateTicketAction,
} from "@/lib/tickets/actions";
import { TicketNotFoundError, createTicketService } from "@/lib/tickets/service";
import { legalTransitionsFrom } from "@/lib/tickets/transitions";
import { Actor } from "@/app/_components/actor";
import { StatusBadge } from "@/app/_components/status-badge";

export const dynamic = "force-dynamic";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/sign-in");

  const { id } = await params;
  const db = getDatabase();

  let ticket;
  try {
    ticket = await createTicketService(db).getTicket(id);
  } catch (error) {
    if (error instanceof TicketNotFoundError) notFound();
    throw error;
  }

  const everyone = await db.select().from(users);
  const byId = new Map(everyone.map((u) => [u.id, u]));
  const legal = legalTransitionsFrom(ticket.status);
  const name = (userId: string | null) =>
    userId ? (byId.get(userId)?.displayName ?? "unknown") : "nobody";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/"
        className="text-sm text-neutral-500 underline-offset-4 hover:underline"
      >
        ← All tickets
      </Link>

      <div className="mt-4 flex items-start gap-3">
        <StatusBadge status={ticket.status} />
        <h1 className="flex-1 text-2xl font-semibold tracking-tight">
          {ticket.title}
        </h1>
      </div>

      <p className="mt-2 text-sm text-neutral-500">
        Reported by{" "}
        <Actor name={name(ticket.reporterId)} kind={ticket.reporterKind} /> ·
        assigned to {name(ticket.assigneeId)}
      </p>

      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-medium">Edit</h2>
        <form action={updateTicketAction} className="mt-3 space-y-3">
          <input type="hidden" name="ticketId" value={ticket.id} />
          <input
            name="title"
            required
            defaultValue={ticket.title}
            aria-label="Title"
            className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300"
          />
          <textarea
            name="description"
            rows={3}
            defaultValue={ticket.description}
            placeholder="Description"
            aria-label="Description"
            className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              name="assigneeId"
              defaultValue={ticket.assigneeId ?? ""}
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
              Save
            </button>
            <span className="text-xs text-neutral-500">
              Status is not editable here: use a Transition.
            </span>
          </div>
        </form>
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-medium">Transition this ticket</h2>
        {legal.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            No legal Transitions from here.
          </p>
        ) : (
          <form action={transitionTicketAction} className="mt-3 space-y-3">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <input
              name="note"
              placeholder="Why? (optional, recorded in history)"
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300"
            />
            <div className="flex flex-wrap gap-2">
              {legal.map((status) => (
                <button
                  key={status}
                  type="submit"
                  name="to"
                  value={status}
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                >
                  Transition to {status}
                </button>
              ))}
            </div>
          </form>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium">History</h2>
        {ticket.history.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Never moved since it was created.
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {ticket.history.map((entry) => (
              <li
                key={entry.id}
                className="rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900"
              >
                <span className="font-medium">
                  {entry.fromStatus} → {entry.toStatus}
                </span>
                <span className="text-neutral-500">
                  {" "}
                  by <Actor name={name(entry.actorId)} kind={entry.actorKind} />
                </span>
                {entry.note ? (
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                    {entry.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <form action={deleteTicketAction} className="mt-10">
        <input type="hidden" name="ticketId" value={ticket.id} />
        <button
          type="submit"
          className="text-sm text-red-600 underline-offset-4 hover:underline dark:text-red-400"
        >
          Delete this ticket
        </button>
      </form>
    </main>
  );
}
