"use server";

/**
 * Server actions for the unified `ReviewSignal` feedback system (§15 of the
 * Final Review Cockpit redesign plan).
 *
 * Surface area:
 *   - createReviewSignal       — top-level signal (comment / pin note / etc.)
 *   - replyToReviewSignal      — threaded reply
 *   - togglePinReviewSignal    — pin / unpin a signal to the cockpit's rail
 *   - resolveReviewSignal      — soft-resolve (the "✓ resolved" state)
 *   - mentionAcknowledge       — mark an @mention as acknowledged
 *   - getReviewSignalsForApplication — read query for the cockpit feed
 *   - findMentionableUsers     — typeahead source for @mention composer
 *
 * RBAC: ADMIN, HIRING_CHAIR, lead reviewer of the application, or any
 * assigned interviewer can author + reply. Pin / resolve are chair-or-admin
 * gated. The applicant themselves cannot read or write signals.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import {
  getHiringActor,
  isAdmin,
  type HiringActor,
} from "@/lib/chapter-hiring-permissions";
import type {
  ReviewSignalKind,
  ReviewSignalSentiment,
} from "@prisma/client";

const MENTION_REGEX = /@([a-z0-9._-]{1,40})/gi;
const SIGNAL_BODY_LIMIT = 5000;

function isHiringChairLike(actor: HiringActor): boolean {
  return isAdmin(actor) || actor.roles.includes("HIRING_CHAIR");
}

async function assertCanReadSignals(
  applicationId: string,
  actor: HiringActor
): Promise<void> {
  if (isHiringChairLike(actor)) return;
  // Lead reviewer of this application?
  const app = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    select: {
      reviewerId: true,
      interviewerAssignments: {
        where: { removedAt: null, interviewerId: actor.id },
        select: { interviewerId: true },
      },
    },
  });
  if (!app) throw new Error("Application not found.");
  if (app.reviewerId === actor.id) return;
  if (app.interviewerAssignments.length > 0) return;
  throw new Error("You don't have access to this application's review signals.");
}

function extractMentionHandles(body: string): string[] {
  const matches = body.match(MENTION_REGEX) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}

async function resolveMentionedUserIds(handles: string[]): Promise<string[]> {
  if (handles.length === 0) return [];
  const users = await prisma.user.findMany({
    where: {
      OR: handles.flatMap((handle) => {
        const stripped = handle.replace(/[._-]/g, "");
        return [
          { email: { startsWith: `${handle}@`, mode: "insensitive" as const } },
          { email: { startsWith: `${stripped}@`, mode: "insensitive" as const } },
          { name: { contains: handle, mode: "insensitive" as const } },
        ];
      }),
    },
    select: { id: true },
    take: 20,
  });
  return Array.from(new Set(users.map((u) => u.id)));
}

export type CreateReviewSignalResult =
  | { success: true; signalId: string }
  | { success: false; error: string };

export interface CreateReviewSignalInput {
  applicationId: string;
  kind?: ReviewSignalKind;
  sentiment?: ReviewSignalSentiment | null;
  body: string;
  parentId?: string | null;
}

export async function createReviewSignal(
  input: CreateReviewSignalInput
): Promise<CreateReviewSignalResult> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (!input.applicationId) {
      return { success: false, error: "Missing applicationId." };
    }
    const body = input.body.trim();
    if (body.length === 0) {
      return { success: false, error: "Add some text before posting." };
    }
    if (body.length > SIGNAL_BODY_LIMIT) {
      return { success: false, error: `Body exceeds the ${SIGNAL_BODY_LIMIT} character limit.` };
    }

    const actor = await getHiringActor(session.user.id);
    await assertCanReadSignals(input.applicationId, actor);

    if (input.parentId) {
      const parent = await prisma.reviewSignal.findUnique({
        where: { id: input.parentId },
        select: { applicationId: true },
      });
      if (!parent || parent.applicationId !== input.applicationId) {
        return { success: false, error: "Parent signal not found for this application." };
      }
    }

    const mentionedUserIds = await resolveMentionedUserIds(extractMentionHandles(body));

    const signal = await prisma.$transaction(async (tx) => {
      const created = await tx.reviewSignal.create({
        data: {
          applicationId: input.applicationId,
          authorId: actor.id,
          kind: input.kind ?? "COMMENT",
          sentiment: input.sentiment ?? null,
          body,
          parentId: input.parentId ?? null,
        },
        select: { id: true },
      });
      if (mentionedUserIds.length > 0) {
        await tx.reviewSignalMention.createMany({
          data: mentionedUserIds.map((userId) => ({
            signalId: created.id,
            userId,
          })),
          skipDuplicates: true,
        });
      }
      return created;
    });

    revalidatePath(`/admin/instructor-applicants/${input.applicationId}/review`);
    return { success: true, signalId: signal.id };
  } catch (error) {
    console.error("[createReviewSignal]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not post signal.",
    };
  }
}

export async function replyToReviewSignal(input: {
  applicationId: string;
  parentId: string;
  body: string;
}): Promise<CreateReviewSignalResult> {
  return createReviewSignal({
    applicationId: input.applicationId,
    body: input.body,
    parentId: input.parentId,
  });
}

export async function togglePinReviewSignal(input: {
  applicationId: string;
  signalId: string;
}): Promise<{ success: boolean; pinned?: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    const actor = await getHiringActor(session.user.id);
    if (!isHiringChairLike(actor)) {
      return { success: false, error: "Only chairs or admins can pin signals." };
    }

    const signal = await prisma.reviewSignal.findUnique({
      where: { id: input.signalId },
      select: { id: true, pinned: true, applicationId: true },
    });
    if (!signal || signal.applicationId !== input.applicationId) {
      return { success: false, error: "Signal not found." };
    }

    const nextPinned = !signal.pinned;
    await prisma.reviewSignal.update({
      where: { id: signal.id },
      data: {
        pinned: nextPinned,
        pinnedAt: nextPinned ? new Date() : null,
        pinnedById: nextPinned ? actor.id : null,
      },
    });
    revalidatePath(`/admin/instructor-applicants/${input.applicationId}/review`);
    return { success: true, pinned: nextPinned };
  } catch (error) {
    console.error("[togglePinReviewSignal]", error);
    return { success: false, error: error instanceof Error ? error.message : "Could not toggle pin." };
  }
}

export async function resolveReviewSignal(input: {
  applicationId: string;
  signalId: string;
  resolved: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    const actor = await getHiringActor(session.user.id);
    if (!isHiringChairLike(actor)) {
      return { success: false, error: "Only chairs or admins can resolve signals." };
    }
    await prisma.reviewSignal.update({
      where: { id: input.signalId },
      data: {
        resolvedAt: input.resolved ? new Date() : null,
        resolvedById: input.resolved ? actor.id : null,
      },
    });
    revalidatePath(`/admin/instructor-applicants/${input.applicationId}/review`);
    return { success: true };
  } catch (error) {
    console.error("[resolveReviewSignal]", error);
    return { success: false, error: error instanceof Error ? error.message : "Could not resolve signal." };
  }
}

export async function acknowledgeReviewSignalMention(
  signalId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    await prisma.reviewSignalMention.update({
      where: { signalId_userId: { signalId, userId: session.user.id } },
      data: { acknowledgedAt: new Date() },
    });
    return { success: true };
  } catch (error) {
    console.error("[acknowledgeReviewSignalMention]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not mark mention read.",
    };
  }
}

export async function findMentionableUsers(
  query: string,
  limit = 6
): Promise<Array<{ id: string; name: string | null; email: string }>> {
  const session = await getSession();
  if (!session?.user?.id) return [];
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { email: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true },
    take: limit,
    orderBy: { name: "asc" },
  });
  return users;
}
