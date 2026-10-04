import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryDatabase } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createTicketService } from "@/lib/tickets/service";
import { type ToolResult, createTicketTools } from "./tools";

const AGENT = { userId: "u-agent", kind: "agent" as const };

async function setup() {
  const db = createInMemoryDatabase();
  await db.insert(users).values([
    { id: "u-ana", email: "ana@example.test", displayName: "Ana" },
    {
      id: "u-agent",
      email: "agent@example.test",
      displayName: "Claude",
      kind: "agent",
    },
  ]);
  const tools = createTicketTools(createTicketService(db));
  return {
    tools,
    call: (name: string, args: unknown) => {
      const tool = tools.find((t) => t.name === name);
      if (!tool) throw new Error(`No tool named ${name}`);
      return tool.handler(args, AGENT);
    },
  };
}

let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  ctx = await setup();
});

/** Narrows a tool result's first content block to text and parses it. */
function payload(result: ToolResult) {
  const [block] = result.content;
  if (block?.type !== "text") {
    throw new Error(`Expected a text content block, got ${block?.type}`);
  }
  return JSON.parse(block.text);
}

function textOf(result: ToolResult): string {
  const [block] = result.content;
  return block?.type === "text" ? block.text : "";
}

describe("the tool surface", () => {
  it("exposes exactly the six agreed tools", () => {
    expect(ctx.tools.map((t) => t.name).sort()).toEqual([
      "create_ticket",
      "delete_ticket",
      "get_ticket",
      "list_tickets",
      "transition_ticket",
      "update_ticket",
    ]);
  });

  it("gives every tool a description, so a caller can choose between them", () => {
    for (const tool of ctx.tools) {
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });
});

describe("create_ticket", () => {
  it("creates a ticket attributed to the calling principal", async () => {
    const result = await ctx.call("create_ticket", { title: "From an agent" });
    expect(payload(result)).toMatchObject({
      title: "From an agent",
      status: "Todo",
      reporterId: "u-agent",
    });
  });

  it("rejects a missing title", async () => {
    const result = await ctx.call("create_ticket", {});
    expect(result.isError).toBe(true);
  });
});

describe("transition_ticket", () => {
  it("moves a ticket and reports the new status", async () => {
    const created = payload(await ctx.call("create_ticket", { title: "Work" }));
    const result = await ctx.call("transition_ticket", {
      ticketId: created.id,
      to: "InProgress",
      note: "starting",
    });
    expect(result.isError).toBeFalsy();
    expect(payload(result)).toMatchObject({ status: "InProgress" });
  });

  it("names the legal transitions when it refuses, not just that it refused", async () => {
    const created = payload(await ctx.call("create_ticket", { title: "Work" }));
    const result = await ctx.call("transition_ticket", {
      ticketId: created.id,
      to: "Done",
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("InProgress");
  });

  it("rejects a status that is not a Status at all", async () => {
    const created = payload(await ctx.call("create_ticket", { title: "Work" }));
    const result = await ctx.call("transition_ticket", {
      ticketId: created.id,
      to: "Shipped",
    });
    expect(result.isError).toBe(true);
  });
});

describe("update_ticket", () => {
  it("updates the fields it owns", async () => {
    const created = payload(await ctx.call("create_ticket", { title: "Old" }));
    const result = await ctx.call("update_ticket", {
      ticketId: created.id,
      title: "New",
    });
    expect(payload(result)).toMatchObject({ title: "New" });
  });

  // ADR 0003, enforced at the boundary rather than silently dropped.
  it("refuses a status argument outright", async () => {
    const created = payload(await ctx.call("create_ticket", { title: "Old" }));
    const result = await ctx.call("update_ticket", {
      ticketId: created.id,
      status: "Done",
    });

    expect(result.isError).toBe(true);
    expect(payload(await ctx.call("get_ticket", { ticketId: created.id })))
      .toMatchObject({ status: "Todo" });
  });
});

describe("get_ticket, list_tickets and delete_ticket", () => {
  it("returns a ticket with its history", async () => {
    const created = payload(await ctx.call("create_ticket", { title: "Work" }));
    await ctx.call("transition_ticket", {
      ticketId: created.id,
      to: "InProgress",
    });
    expect(payload(await ctx.call("get_ticket", { ticketId: created.id })).history)
      .toHaveLength(1);
  });

  it("reports a missing ticket as an error rather than throwing", async () => {
    const result = await ctx.call("get_ticket", { ticketId: "nope" });
    expect(result.isError).toBe(true);
  });

  it("lists tickets and filters them by status", async () => {
    await ctx.call("create_ticket", { title: "One" });
    const two = payload(await ctx.call("create_ticket", { title: "Two" }));
    await ctx.call("transition_ticket", { ticketId: two.id, to: "InProgress" });

    expect(payload(await ctx.call("list_tickets", {}))).toHaveLength(2);
    expect(payload(await ctx.call("list_tickets", { status: "InProgress" })))
      .toHaveLength(1);
  });

  it("deletes a ticket", async () => {
    const created = payload(await ctx.call("create_ticket", { title: "Doomed" }));
    expect((await ctx.call("delete_ticket", { ticketId: created.id })).isError)
      .toBeFalsy();
    expect((await ctx.call("get_ticket", { ticketId: created.id })).isError)
      .toBe(true);
  });
});
