"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";

/**
 * People Strategy — Saved Action View server actions (Phase 9).
 *
 * Officer-tier and above save / delete their own filter sets on the Action
 * Tracker. Standard `"use server"` → guard → zod → prisma → revalidate, gated
 * by ENABLE_ACTION_TRACKER. Saving by name is idempotent (upsert on the unique
 * (userId, name)), so re-saving a view updates its filters.
 */

function ensureEnabled() {
  if (!isActionTrackerEnabled()) throw new Error("Action Tracker is not enabled");
}

const SaveSchema = z.object({
  name: z.string().trim().min(1).max(60),
  // The serialized filter query string (no leading "?"). Capped for sanity; an
  // empty string is allowed and means "the unfiltered view".
  query: z.string().trim().max(500),
});

export async function saveActionView(input: { name: string; query: string }) {
  ensureEnabled();
  const session = await requireOfficer();
  const data = SaveSchema.parse(input);

  await prisma.savedActionView.upsert({
    where: { userId_name: { userId: session.id, name: data.name } },
    create: { userId: session.id, name: data.name, query: data.query },
    update: { query: data.query },
  });

  revalidatePath("/actions/all");
  return { ok: true };
}

export async function deleteActionView(id: string) {
  ensureEnabled();
  const session = await requireOfficer();
  if (!id) throw new Error("id required");

  // Scope the delete to the owner so one officer can't delete another's view.
  await prisma.savedActionView.deleteMany({ where: { id, userId: session.id } });

  revalidatePath("/actions/all");
  return { ok: true };
}
