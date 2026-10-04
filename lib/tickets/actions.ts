"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentPrincipal } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { createTicketService } from "./service";
import { isStatus } from "./transitions";

async function requirePrincipal() {
  const principal = await currentPrincipal();
  if (!principal) redirect("/login");
  return principal;
}

export async function createTicketAction(formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  await createTicketService(getDatabase()).createTicket(principal.userId, {
    title,
    description: String(formData.get("description") ?? ""),
    assigneeId,
  });
  revalidatePath("/");
}

export async function transitionTicketAction(
  formData: FormData,
): Promise<void> {
  const principal = await requirePrincipal();
  const ticketId = String(formData.get("ticketId") ?? "");
  const to = String(formData.get("to") ?? "");
  if (!ticketId || !isStatus(to)) return;

  const note = String(formData.get("note") ?? "").trim() || null;
  await createTicketService(getDatabase()).transitionTicket(principal.userId, {
    ticketId,
    to,
    note,
  });
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/");
}

export async function deleteTicketAction(formData: FormData): Promise<void> {
  await requirePrincipal();
  const ticketId = String(formData.get("ticketId") ?? "");
  if (!ticketId) return;
  await createTicketService(getDatabase()).deleteTicket(ticketId);
  revalidatePath("/");
  redirect("/");
}
