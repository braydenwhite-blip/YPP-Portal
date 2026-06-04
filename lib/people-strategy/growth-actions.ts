"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { GrowthTag } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";

import { GROWTH_TAG_VALUES } from "./growth-signals";

/**
 * People Strategy — Growth Signal server actions (Phase 8).
 *
 * Officer-tier and above attach/remove growth tags from the Responsibility Map.
 * Follows the established `"use server"` → guard → zod → prisma → revalidate
 * convention, gated by ENABLE_ACTION_TRACKER. Toggling is idempotent thanks to
 * the unique (userId, tag) constraint.
 */

const RESPONSIBILITY_PATHS = ["/actions/responsibility", "/actions/command-center"];

function revalidateAll() {
  for (const path of RESPONSIBILITY_PATHS) revalidatePath(path);
}

function ensureEnabled() {
  if (!isActionTrackerEnabled()) {
    throw new Error("Action Tracker is not enabled");
  }
}

const AddTagSchema = z.object({
  userId: z.string().trim().min(1),
  tag: z.enum(GROWTH_TAG_VALUES as [string, ...string[]]),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function addGrowthTag(input: {
  userId: string;
  tag: GrowthTag;
  note?: string;
}) {
  ensureEnabled();
  const session = await requireOfficer();
  const data = AddTagSchema.parse(input);

  const member = await prisma.user.findFirst({
    where: { id: data.userId, archivedAt: null },
    select: { id: true },
  });
  if (!member) throw new Error("Member not found");

  await prisma.memberGrowthTag.upsert({
    where: { userId_tag: { userId: data.userId, tag: data.tag as GrowthTag } },
    create: {
      userId: data.userId,
      tag: data.tag as GrowthTag,
      note: data.note,
      createdById: session.id,
    },
    update: { note: data.note, createdById: session.id },
  });

  revalidateAll();
  return { ok: true };
}

const RemoveTagSchema = z.object({
  userId: z.string().trim().min(1),
  tag: z.enum(GROWTH_TAG_VALUES as [string, ...string[]]),
});

export async function removeGrowthTag(input: { userId: string; tag: GrowthTag }) {
  ensureEnabled();
  await requireOfficer();
  const data = RemoveTagSchema.parse(input);

  await prisma.memberGrowthTag.deleteMany({
    where: { userId: data.userId, tag: data.tag as GrowthTag },
  });

  revalidateAll();
  return { ok: true };
}
