"use server";

/**
 * Student Operating System / Growth Engine (Phase N1) — student server actions.
 *
 * House style: "use server" -> flag guard -> session guard -> ownership check ->
 * prisma -> revalidatePath. Every mutation is scoped to the signed-in user's own
 * Growth* rows. Off (ENABLE_GROWTH_OS unset) every action throws, so the surfaces
 * are inert. Mutations that can change the opportunity/stalled-goal picture
 * trigger a best-effort recompute so the command center stays consistent.
 */

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { isGrowthOsEnabled } from "@/lib/feature-flags";
import { isGrowthTrack, normalizeActionStatus } from "./constants";
import { recomputeGrowthForUser } from "./recompute";

const MAX_TITLE = 200;

async function requireGrowthUser(): Promise<string> {
  if (!isGrowthOsEnabled()) throw new Error("Growth OS is not enabled");
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function safeRecompute(userId: string): Promise<void> {
  try {
    await recomputeGrowthForUser(userId);
  } catch (error) {
    console.error("[growth actions] recompute failed:", error);
  }
}

/** Dismiss a suggested opportunity so the engine never re-suggests it. */
export async function dismissGrowthOpportunity(formData: FormData): Promise<void> {
  const userId = await requireGrowthUser();
  const key = text(formData, "key");
  if (!key) return;
  await prisma.growthOpportunity.updateMany({
    where: { userId, key, status: "SUGGESTED" },
    data: { status: "DISMISSED" },
  });
  revalidatePath("/my-growth");
}

/** Set the status of one of the user's own actions (e.g. mark it DONE). */
export async function setGrowthActionStatus(formData: FormData): Promise<void> {
  const userId = await requireGrowthUser();
  const id = text(formData, "id");
  if (!id) return;
  const status = normalizeActionStatus(text(formData, "status"));
  const owned = await prisma.growthAction.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) return;
  await prisma.growthAction.update({
    where: { id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
  await safeRecompute(userId);
  revalidatePath("/my-growth");
}

/** Quick-add a standalone goal (skip-level — no vision required). */
export async function createGrowthGoal(formData: FormData): Promise<void> {
  const userId = await requireGrowthUser();
  const title = text(formData, "title").slice(0, MAX_TITLE);
  if (!title) return;
  const trackRaw = text(formData, "track");
  const track = isGrowthTrack(trackRaw) ? trackRaw : "STUDENT";
  const count = await prisma.growthGoal.count({ where: { userId, visionId: null } });
  await prisma.growthGoal.create({
    data: { userId, title, track, order: count },
  });
  await safeRecompute(userId);
  revalidatePath("/my-growth");
}

/** Add an action under one of the user's own goals. */
export async function addGrowthAction(formData: FormData): Promise<void> {
  const userId = await requireGrowthUser();
  const goalId = text(formData, "goalId");
  const title = text(formData, "title").slice(0, MAX_TITLE);
  if (!goalId || !title) return;
  const goal = await prisma.growthGoal.findFirst({
    where: { id: goalId, userId },
    select: { id: true },
  });
  if (!goal) return;
  const count = await prisma.growthAction.count({ where: { goalId, milestoneId: null } });
  await prisma.growthAction.create({
    data: { userId, goalId, title, order: count },
  });
  await safeRecompute(userId);
  revalidatePath("/my-growth");
}
