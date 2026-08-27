"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorization-helpers";
import { prisma } from "@/lib/prisma";

import { loadHiringWaitlist } from "./load";
import {
  getHiringWaitlistOrder,
  mergeWaitlistOrder,
  setHiringWaitlistOrder,
} from "./order-store";
import { parseWaitlistKey, type HiringWaitlistKind } from "./types";

const MoveSchema = z.object({
  key: z.string().min(1),
  direction: z.enum(["up", "down", "top"]),
});

const ReorderSchema = z.object({
  order: z.array(z.string().min(1)).max(500),
});

const SelectSchema = z.object({
  key: z.string().min(1),
});

function revalidateWaitlist() {
  revalidatePath("/admin/applicants/waitlist");
  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/admin/applicants");
  revalidatePath("/admin/chapter-president-applicants");
  revalidatePath("/applications");
}

function interviewHref(kind: HiringWaitlistKind, id: string): string {
  if (kind === "cp") return `/admin/chapter-president-applicants/${id}`;
  if (kind === "staff") return `/applications/${id}`;
  return `/admin/instructor-applicants/${id}`;
}

async function currentOrderedKeys(): Promise<string[]> {
  const entries = await loadHiringWaitlist();
  return entries.map((e) => e.key);
}

export async function moveHiringWaitlistEntry(input: unknown): Promise<
  | { ok: true; order: string[] }
  | { ok: false; error: string }
> {
  await requireAdmin();
  const data = MoveSchema.parse(input);
  if (!parseWaitlistKey(data.key)) {
    return { ok: false, error: "Invalid waitlist entry." };
  }

  const order = await currentOrderedKeys();
  const idx = order.indexOf(data.key);
  if (idx < 0) return { ok: false, error: "Person is not on the waitlist." };

  const next = [...order];
  if (data.direction === "top") {
    next.splice(idx, 1);
    next.unshift(data.key);
  } else if (data.direction === "up" && idx > 0) {
    [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
  } else if (data.direction === "down" && idx < next.length - 1) {
    [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
  }

  await setHiringWaitlistOrder(next);
  revalidateWaitlist();
  return { ok: true, order: next };
}

export async function setHiringWaitlistOrderAction(input: unknown): Promise<
  | { ok: true; order: string[] }
  | { ok: false; error: string }
> {
  await requireAdmin();
  const data = ReorderSchema.parse(input);
  for (const key of data.order) {
    if (!parseWaitlistKey(key)) {
      return { ok: false, error: "Invalid waitlist entry in order." };
    }
  }

  const live = await loadHiringWaitlist();
  const liveMeta = live.map((e) => ({ key: e.key, waitlistedAt: e.waitlistedAt }));
  const merged = mergeWaitlistOrder(data.order, liveMeta);
  await setHiringWaitlistOrder(merged);
  revalidateWaitlist();
  return { ok: true, order: merged };
}

/** Returns the next person in the hire queue (position 1). */
export async function getNextHiringWaitlistCandidate(): Promise<
  | { ok: true; entry: Awaited<ReturnType<typeof loadHiringWaitlist>>[number] | null }
  | { ok: false; error: string }
> {
  await requireAdmin();
  const entries = await loadHiringWaitlist();
  return { ok: true, entry: entries[0] ?? null };
}

/**
 * Pull someone off the hire waitlist into the interview pipeline.
 * They leave the waitlist and show up on /admin/applicants (Interview column, newest first).
 */
export async function selectHiringWaitlistCandidate(input: unknown): Promise<
  { ok: false; error: string }
> {
  await requireAdmin();
  const data = SelectSchema.parse(input);
  const parsed = parseWaitlistKey(data.key);
  if (!parsed) return { ok: false, error: "Invalid waitlist entry." };

  const live = await loadHiringWaitlist();
  if (!live.some((e) => e.key === data.key)) {
    return { ok: false, error: "Person is not on the waitlist anymore." };
  }

  const { kind, id } = parsed;

  try {
    if (kind === "instructor") {
      const app = await prisma.instructorApplication.findUnique({
        where: { id },
        select: { id: true, archivedAt: true },
      });
      if (!app || app.archivedAt) {
        return { ok: false, error: "Instructor application not found." };
      }
      await prisma.instructorApplication.update({
        where: { id },
        data: { status: "PRE_APPROVED", updatedAt: new Date() },
      });
    } else if (kind === "cp") {
      const app = await prisma.chapterPresidentApplication.findUnique({
        where: { id },
        select: { id: true, archivedAt: true },
      });
      if (!app || app.archivedAt) {
        return { ok: false, error: "Chapter president application not found." };
      }
      await prisma.chapterPresidentApplication.update({
        where: { id },
        data: { status: "INTERVIEW_NEEDED", updatedAt: new Date() },
      });
    } else {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Application"
        WHERE id = ${id} AND "archivedAt" IS NULL
        LIMIT 1
      `;
      if (!rows[0]) return { ok: false, error: "Staff application not found." };
      await prisma.$executeRaw`
        UPDATE "Application"
        SET status = 'INTERVIEW_SCHEDULED'::"ApplicationStatus", "updatedAt" = NOW()
        WHERE id = ${id}
      `;
    }
  } catch (err) {
    console.error("[selectHiringWaitlistCandidate]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not start interviews.",
    };
  }

  const remaining = (await getHiringWaitlistOrder()).filter((k) => k !== data.key);
  await setHiringWaitlistOrder(remaining);

  revalidateWaitlist();
  revalidatePath(interviewHref(kind, id));

  // Land on the unified applicants board (Interview / Chair / Decided), newest first.
  redirect("/admin/applicants");
}
