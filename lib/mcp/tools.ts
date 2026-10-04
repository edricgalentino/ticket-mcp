import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Principal } from "@/lib/auth/principal";
import {
  IllegalTransitionError,
  TicketNotFoundError,
  type TicketService,
} from "@/lib/tickets/service";
import { STATUSES } from "@/lib/tickets/transitions";

/** The SDK's own result shape, so handlers drop straight into a Server. */
export type ToolResult = CallToolResult;

export interface TicketTool {
  name: string;
  description: string;
  schema: z.ZodType;
  handler: (args: unknown, principal: Principal) => Promise<ToolResult>;
}

const ok = (value: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});

const fail = (message: string): ToolResult => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

const status = z.enum(STATUSES);
const ticketId = z
  .string()
  .min(1)
  .describe("The Ticket's id, as returned by create_ticket or list_tickets.");

/**
 * Strict objects throughout: an unknown argument is an error, not something to
 * drop quietly. That is how `update_ticket` refuses a `status` rather than
 * appearing to accept one and doing nothing -- see ADR 0003.
 */
const schemas = {
  create_ticket: z.strictObject({
    title: z.string().min(1).describe("Short summary of the work."),
    description: z.string().optional().describe("Fuller detail. Optional."),
    assigneeId: z
      .string()
      .nullish()
      .describe("User id to assign to. Omit to leave unassigned."),
  }),
  get_ticket: z.strictObject({ ticketId }),
  list_tickets: z.strictObject({
    status: status.optional().describe("Only Tickets in this Status."),
    assigneeId: z
      .string()
      .nullish()
      .describe("Only Tickets assigned to this User. Pass null for unassigned."),
  }),
  update_ticket: z.strictObject({
    ticketId,
    title: z
      .string()
      .min(1)
      .optional()
      .describe("New title. Omit to leave the current one unchanged."),
    description: z
      .string()
      .optional()
      .describe("New description. Omit to leave unchanged; pass \"\" to clear."),
    assigneeId: z
      .string()
      .nullish()
      .describe(
        "User id to assign to. Omit to leave unchanged; pass null to unassign.",
      ),
  }),
  delete_ticket: z.strictObject({ ticketId }),
  transition_ticket: z.strictObject({
    ticketId,
    to: status.describe("The Status to transition to."),
    note: z.string().nullish().describe("Why. Recorded in the Ticket's history."),
  }),
};

function describeZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

/**
 * Domain errors are written for the caller and are returned as-is. Anything
 * else is a database or runtime message that the caller has no business
 * seeing, so it is logged here and reported generically.
 */
function explain(error: unknown): string {
  if (
    error instanceof IllegalTransitionError ||
    error instanceof TicketNotFoundError
  ) {
    return error.message;
  }
  console.error("[ticket-mcp] unexpected tool failure:", error);
  return "The operation failed unexpectedly. Check the server logs.";
}

export function createTicketTools(service: TicketService): TicketTool[] {
  function tool<S extends z.ZodType>(
    name: string,
    description: string,
    schema: S,
    run: (args: z.output<S>, principal: Principal) => Promise<unknown>,
  ): TicketTool {
    return {
      name,
      description,
      schema,
      async handler(args, principal) {
        const parsed = schema.safeParse(args ?? {});
        if (!parsed.success) return fail(describeZodError(parsed.error));
        try {
          return ok(await run(parsed.data, principal));
        } catch (error) {
          return fail(explain(error));
        }
      },
    };
  }

  return [
    tool(
      "create_ticket",
      "Create a new Ticket. It starts in the Todo status and is reported by the calling principal.",
      schemas.create_ticket,
      (args, principal) =>
        service.createTicket(principal, {
          title: args.title,
          description: args.description,
          assigneeId: args.assigneeId ?? null,
        }),
    ),
    tool(
      "get_ticket",
      "Fetch one Ticket by id, together with its full Transition history, oldest first.",
      schemas.get_ticket,
      (args) => service.getTicket(args.ticketId),
    ),
    tool(
      "list_tickets",
      "List Tickets, newest first. Optionally filter by status, by assignee, or by both.",
      schemas.list_tickets,
      (args) =>
        service.listTickets({
          status: args.status,
          assigneeId: args.assigneeId,
        }),
    ),
    tool(
      "update_ticket",
      "Change a Ticket's title, description or assignee. Cannot change status: use transition_ticket for that.",
      schemas.update_ticket,
      (args, principal) =>
        service.updateTicket(principal, {
          ticketId: args.ticketId,
          title: args.title,
          description: args.description,
          assigneeId: args.assigneeId,
        }),
    ),
    tool(
      "delete_ticket",
      "Permanently delete a Ticket and its Transition history. This cannot be undone.",
      schemas.delete_ticket,
      async (args, principal) => {
        await service.deleteTicket(principal, args.ticketId);
        return { deleted: args.ticketId };
      },
    ),
    tool(
      "transition_ticket",
      "Transition a Ticket to another Status. Only legal Transitions are accepted; a refusal names the ones that were allowed.",
      schemas.transition_ticket,
      (args, principal) =>
        service.transitionTicket(principal, {
          ticketId: args.ticketId,
          to: args.to,
          note: args.note,
        }),
    ),
  ];
}
