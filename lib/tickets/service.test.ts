import { beforeEach, describe, expect, it } from "vitest";
import type { Principal } from "@/lib/auth/principal";
import { createInMemoryDatabase } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  IllegalTransitionError,
  TicketNotFoundError,
  createTicketService,
} from "./service";

const ANA: Principal = { userId: "u-ana", kind: "human" };
const BO: Principal = { userId: "u-bo", kind: "human" };
const AGENT: Principal = { userId: "u-agent", kind: "agent" };

async function setup() {
  const db = createInMemoryDatabase();
  await db.insert(users).values([
    { id: "u-ana", email: "ana@example.test", displayName: "Ana" },
    { id: "u-bo", email: "bo@example.test", displayName: "Bo" },
    {
      id: "u-agent",
      email: "agent@example.test",
      displayName: "Claude",
      kind: "agent",
    },
  ]);
  return { db, service: createTicketService(db) };
}

let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  ctx = await setup();
});

describe("transitionTicket", () => {
  it("rejects a move that is not a legal Transition", async () => {
    const ticket = await ctx.service.createTicket(ANA, {
      title: "Ship the MCP server",
    });

    await expect(
      ctx.service.transitionTicket(ANA, {
        ticketId: ticket.id,
        to: "Done",
      }),
    ).rejects.toThrow(IllegalTransitionError);
  });

  it("tells the caller which Transitions were legal instead of only saying no", async () => {
    const ticket = await ctx.service.createTicket(ANA, {
      title: "Ship the MCP server",
    });

    await expect(
      ctx.service.transitionTicket(ANA, {
        ticketId: ticket.id,
        to: "Done",
      }),
    ).rejects.toMatchObject({ legalTransitions: ["InProgress"] });
  });
});

describe("transitionTicket, when the move is legal", () => {
  it("moves the ticket and records the move in its history", async () => {
    const ticket = await ctx.service.createTicket(ANA, {
      title: "Ship the MCP server",
    });

    await ctx.service.transitionTicket(ANA, {
      ticketId: ticket.id,
      to: "InProgress",
      note: "picked this up",
    });

    const after = await ctx.service.getTicket(ticket.id);
    expect(after.status).toBe("InProgress");
    expect(after.history).toHaveLength(1);
    expect(after.history[0]).toMatchObject({
      fromStatus: "Todo",
      toStatus: "InProgress",
      note: "picked this up",
      actorId: "u-ana",
    });
  });

  it("records a transition with no note when none is given", async () => {
    const ticket = await ctx.service.createTicket(ANA, { title: "Seed data" });
    await ctx.service.transitionTicket(ANA, {
      ticketId: ticket.id,
      to: "InProgress",
    });

    const after = await ctx.service.getTicket(ticket.id);
    expect(after.history[0].note).toBeNull();
  });

  it("accumulates history across the full cycle, including the reopen", async () => {
    const ticket = await ctx.service.createTicket(ANA, { title: "Round trip" });
    await ctx.service.transitionTicket(ANA, { ticketId: ticket.id, to: "InProgress" });
    await ctx.service.transitionTicket(BO, { ticketId: ticket.id, to: "Done" });
    await ctx.service.transitionTicket(AGENT, { ticketId: ticket.id, to: "Todo" });

    const after = await ctx.service.getTicket(ticket.id);
    expect(after.status).toBe("Todo");
    expect(after.history.map((h) => `${h.fromStatus}->${h.toStatus}`)).toEqual([
      "Todo->InProgress",
      "InProgress->Done",
      "Done->Todo",
    ]);
  });
});

describe("updateTicket", () => {
  it("changes title, description and assignee", async () => {
    const ticket = await ctx.service.createTicket(ANA, { title: "Draft" });

    const updated = await ctx.service.updateTicket(ANA, {
      ticketId: ticket.id,
      title: "Ship the MCP server",
      description: "Six tools, one route handler.",
      assigneeId: "u-bo",
    });

    expect(updated).toMatchObject({
      title: "Ship the MCP server",
      description: "Six tools, one route handler.",
      assigneeId: "u-bo",
    });
  });

  it("can unassign a ticket", async () => {
    const ticket = await ctx.service.createTicket(ANA, {
      title: "Draft",
      assigneeId: "u-bo",
    });
    const updated = await ctx.service.updateTicket(ANA, {
      ticketId: ticket.id,
      assigneeId: null,
    });
    expect(updated.assigneeId).toBeNull();
  });

  it("leaves fields alone when they are not supplied", async () => {
    const ticket = await ctx.service.createTicket(ANA, {
      title: "Keep me",
      description: "and me",
      assigneeId: "u-bo",
    });
    const updated = await ctx.service.updateTicket(ANA, {
      ticketId: ticket.id,
      title: "Renamed",
    });
    expect(updated).toMatchObject({
      title: "Renamed",
      description: "and me",
      assigneeId: "u-bo",
    });
  });

  // ADR 0003: status moves only through transitionTicket. MCP arguments arrive
  // as untyped JSON, so a caller smuggling a status through must be ignored.
  it("cannot change status, even when one is smuggled in", async () => {
    const ticket = await ctx.service.createTicket(ANA, { title: "Draft" });

    const updated = await ctx.service.updateTicket(ANA, {
      ticketId: ticket.id,
      title: "Renamed",
      status: "Done",
    } as Parameters<typeof ctx.service.updateTicket>[1]);

    expect(updated.status).toBe("Todo");
    const after = await ctx.service.getTicket(ticket.id);
    expect(after.status).toBe("Todo");
    expect(after.history).toHaveLength(0);
  });
});

describe("listTickets", () => {
  async function threeTickets() {
    const a = await ctx.service.createTicket(ANA, {
      title: "Assigned to Bo",
      assigneeId: "u-bo",
    });
    const b = await ctx.service.createTicket(BO, {
      title: "Assigned to nobody",
    });
    const c = await ctx.service.createTicket(AGENT, {
      title: "Agent's own, in progress",
      assigneeId: "u-agent",
    });
    await ctx.service.transitionTicket(AGENT, {
      ticketId: c.id,
      to: "InProgress",
    });
    return { a, b, c };
  }

  it("returns every ticket when given no filter", async () => {
    await threeTickets();
    expect(await ctx.service.listTickets()).toHaveLength(3);
  });

  it("filters by status", async () => {
    const { c } = await threeTickets();
    const inProgress = await ctx.service.listTickets({ status: "InProgress" });
    expect(inProgress.map((t) => t.id)).toEqual([c.id]);
  });

  it("filters by assignee", async () => {
    const { a } = await threeTickets();
    const bos = await ctx.service.listTickets({ assigneeId: "u-bo" });
    expect(bos.map((t) => t.id)).toEqual([a.id]);
  });

  it("combines filters", async () => {
    await threeTickets();
    expect(
      await ctx.service.listTickets({ status: "Todo", assigneeId: "u-agent" }),
    ).toHaveLength(0);
  });

  it("finds tickets that nobody is assigned to", async () => {
    const { b } = await threeTickets();
    const unassigned = await ctx.service.listTickets({ assigneeId: null });
    expect(unassigned.map((t) => t.id)).toEqual([b.id]);
  });
});

describe("deleteTicket", () => {
  it("removes the ticket", async () => {
    const ticket = await ctx.service.createTicket(ANA, { title: "Doomed" });
    await ctx.service.deleteTicket(ANA, ticket.id);
    await expect(ctx.service.getTicket(ticket.id)).rejects.toThrow(
      TicketNotFoundError,
    );
  });

  it("takes the ticket's transition history with it", async () => {
    const ticket = await ctx.service.createTicket(ANA, { title: "Doomed" });
    await ctx.service.transitionTicket(ANA, {
      ticketId: ticket.id,
      to: "InProgress",
    });
    await ctx.service.deleteTicket(ANA, ticket.id);

    // The cascade itself is not observable through the public interface once
    // the Ticket is gone, so what is asserted here is that a later Ticket does
    // not inherit the dead one's history.
    const survivor = await ctx.service.createTicket(ANA, { title: "Alive" });
    expect((await ctx.service.getTicket(survivor.id)).history).toHaveLength(0);
  });

  it("refuses to delete a ticket that is not there", async () => {
    await expect(ctx.service.deleteTicket(ANA, "nope")).rejects.toThrow(
      TicketNotFoundError,
    );
  });
});

// ADR 0004: the mode an action was taken in is recorded against the action,
// not inferred from the identity that took it.
describe("recording how an action was taken", () => {
  it("records that a human reported a ticket", async () => {
    const ticket = await ctx.service.createTicket(ANA, { title: "By hand" });
    expect(ticket.reporterKind).toBe("human");
  });

  it("records that an agent reported a ticket", async () => {
    const ticket = await ctx.service.createTicket(AGENT, { title: "By tool" });
    expect(ticket.reporterKind).toBe("agent");
  });

  it("records the mode of each transition independently of the reporter", async () => {
    const ticket = await ctx.service.createTicket(ANA, { title: "Handover" });
    await ctx.service.transitionTicket(AGENT, {
      ticketId: ticket.id,
      to: "InProgress",
    });
    await ctx.service.transitionTicket(ANA, { ticketId: ticket.id, to: "Done" });

    const after = await ctx.service.getTicket(ticket.id);
    expect(after.reporterKind).toBe("human");
    expect(after.history.map((h) => [h.actorId, h.actorKind])).toEqual([
      ["u-agent", "agent"],
      ["u-ana", "human"],
    ]);
  });

  it("lets one User appear in both modes on the same ticket", async () => {
    const ANA_AS_AGENT: Principal = { userId: "u-ana", kind: "agent" };
    const ticket = await ctx.service.createTicket(ANA, { title: "Two modes" });
    await ctx.service.transitionTicket(ANA_AS_AGENT, {
      ticketId: ticket.id,
      to: "InProgress",
    });

    const after = await ctx.service.getTicket(ticket.id);
    expect(after.reporterKind).toBe("human");
    expect(after.history[0]).toMatchObject({
      actorId: "u-ana",
      actorKind: "agent",
    });
  });
});
