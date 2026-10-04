import type { Status } from "@/lib/tickets/transitions";

const TONE: Record<Status, string> = {
  Todo: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
  InProgress: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  Done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
};

const LABEL: Record<Status, string> = {
  Todo: "Todo",
  InProgress: "In progress",
  Done: "Done",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TONE[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}
