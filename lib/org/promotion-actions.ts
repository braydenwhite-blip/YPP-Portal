"use server";

/**
 * Promotion / role-change actions (Phase 8 of
 * docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md).
 *
 * Promotions are run from the person profile: pick a new title/chapter/cohort/
 * committees/mentor, PREVIEW the access added vs removed + setup still needed,
 * then APPLY non-destructively. Nothing — account, reviews, actions, history —
 * is ever deleted; committee removals are soft (isActive=false + endDate), and a
 * PromotionRecord + AuditLog entry capture the change with reason, effective
 * date, and actor.
 *
 * Changing a person's INTERNAL LEVEL is Board-only (SUPER_ADMIN), per the
 * proposal; other promotions are open to officer-tier admins.
 */

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  requireSessionUser,
  hasRole,
  hasAnyAdminSubtype,
  type SessionUser,
} from "@/lib/authorization";
import { logAuditEvent } from "@/lib/audit-log-actions";
import { normalizeTitle } from "@/lib/org/levels";
import {
  buildPromotionPreview,
  type PersonPromotionState,
  type PromotionPreview,
} from "@/lib/org/promotion";
import { reassignPrimaryMentor } from "@/lib/mentorship-reassign-actions";

export interface PromotionInput {
  userId: string;
  /** New canonical title (e.g. "Lead Instructor"); falls back to null if unknown. */
  newTitle: string;
  effectiveDate: string;
  reason?: string | null;
  /** Provide a non-empty chapter id to move chapters; omit/empty leaves it. */
  newChapterId?: string | null;
  addCommittees?: string[];
  removeCommittees?: string[];
  assignMentorId?: string | null;
}

function officerish(session: SessionUser): boolean {
  return (
    hasRole(session.roles, "ADMIN", session.primaryRole) ||
    hasRole(session.roles, "STAFF", session.primaryRole) ||
    hasRole(session.roles, "CHAPTER_PRESIDENT", session.primaryRole) ||
    hasAnyAdminSubtype(session.adminSubtypes, ["SUPER_ADMIN", "LEADERSHIP", "MENTORSHIP_ADMIN"])
  );
}

function isBoard(session: SessionUser): boolean {
  return hasAnyAdminSubtype(session.adminSubtypes, ["SUPER_ADMIN"]);
}

async function loadPromotionState(userId: string): Promise<PersonPromotionState> {
  const [user, mentorCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        name: true,
        title: true,
        canonicalTitle: true,
        internalLevel: true,
        ladder: true,
        chapterId: true,
        cohortId: true,
        committeeMemberships: {
          where: { isActive: true, committee: { archivedAt: null } },
          select: { committee: { select: { name: true } } },
        },
      },
    }),
    prisma.mentorship.count({ where: { menteeId: userId, status: "ACTIVE" } }),
  ]);

  return {
    name: user.name,
    title: normalizeTitle(user.canonicalTitle ?? user.title),
    internalLevel: user.internalLevel,
    ladder: (user.ladder as PersonPromotionState["ladder"]) ?? null,
    chapterId: user.chapterId,
    cohortId: user.cohortId,
    committees: user.committeeMemberships.map((m) => m.committee.name),
    hasPrimaryMentor: mentorCount > 0,
  };
}

function toChange(state: PersonPromotionState, input: PromotionInput) {
  const newChapterId =
    input.newChapterId && input.newChapterId.trim() ? input.newChapterId.trim() : undefined;
  return {
    state,
    change: {
      newTitle: normalizeTitle(input.newTitle),
      newChapterId,
      addCommittees: input.addCommittees ?? [],
      removeCommittees: input.removeCommittees ?? [],
      assignMentorId: input.assignMentorId?.trim() || undefined,
      effectiveDate: input.effectiveDate,
      reason: input.reason ?? null,
    },
  };
}

/** Compute the before-saving preview (auth-gated, no writes). */
export async function previewPromotion(input: PromotionInput): Promise<PromotionPreview> {
  const session = await requireSessionUser();
  if (!officerish(session)) {
    throw new Error("Unauthorized: only officers and Board Members can run promotions.");
  }
  const state = await loadPromotionState(input.userId);
  const { change } = toChange(state, input);
  return buildPromotionPreview(state, change);
}

async function ensureCommittee(
  tx: Prisma.TransactionClient,
  name: string
): Promise<string> {
  const existing = await tx.committee.findUnique({ where: { name }, select: { id: true } });
  if (existing) return existing.id;
  const created = await tx.committee.create({
    data: { name, kind: name },
    select: { id: true },
  });
  return created.id;
}

export interface ApplyPromotionResult {
  applied: boolean;
  setupComplete: boolean;
  preview: PromotionPreview;
}

/** Apply the promotion non-destructively. */
export async function applyPromotion(input: PromotionInput): Promise<ApplyPromotionResult> {
  const session = await requireSessionUser();
  if (!officerish(session)) {
    throw new Error("Unauthorized: only officers and Board Members can run promotions.");
  }

  const state = await loadPromotionState(input.userId);
  const { change } = toChange(state, input);
  const preview = buildPromotionPreview(state, change);

  // Changing the internal level is Board-only.
  const levelChanges = preview.levelFrom !== preview.levelTo;
  if (levelChanges && !isBoard(session)) {
    throw new Error("Unauthorized: only Board Members can change a person's internal level.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: {
        title: change.newTitle ?? undefined,
        canonicalTitle: change.newTitle ?? undefined,
        internalLevel: preview.levelTo ?? undefined,
        ladder: preview.ladderTo ?? undefined,
        ...(change.newChapterId !== undefined ? { chapterId: change.newChapterId } : {}),
      },
    });

    for (const name of preview.committeesAdded) {
      const committeeId = await ensureCommittee(tx, name);
      await tx.committeeMembership.upsert({
        where: { committeeId_userId: { committeeId, userId: input.userId } },
        create: { committeeId, userId: input.userId, isActive: true, startDate: new Date() },
        update: { isActive: true, endDate: null },
      });
    }

    for (const name of preview.committeesRemoved) {
      const committee = await tx.committee.findUnique({ where: { name }, select: { id: true } });
      if (!committee) continue;
      await tx.committeeMembership.updateMany({
        where: { committeeId: committee.id, userId: input.userId, isActive: true },
        data: { isActive: false, endDate: new Date() },
      });
    }

    await tx.promotionRecord.create({
      data: {
        userId: input.userId,
        effectiveDate: new Date(change.effectiveDate),
        reason: change.reason,
        previousTitle: state.title,
        newTitle: change.newTitle,
        previousInternalLevel: preview.levelFrom,
        newInternalLevel: preview.levelTo,
        previousLadder: state.ladder ?? undefined,
        newLadder: preview.ladderTo ?? undefined,
        previousChapterId: state.chapterId,
        newChapterId: change.newChapterId !== undefined ? change.newChapterId : state.chapterId,
        previousCohortId: state.cohortId,
        committeesAdded: JSON.stringify(preview.committeesAdded),
        committeesRemoved: JSON.stringify(preview.committeesRemoved),
        pendingSetup: JSON.stringify(preview.setupItems.map((s) => s.code)),
        setupComplete: preview.setupComplete,
        actorId: session.id,
      },
    });
  });

  // Mentor reassignment runs through its own audited, non-destructive path.
  if (change.assignMentorId) {
    await reassignPrimaryMentor({
      menteeId: input.userId,
      newMentorId: change.assignMentorId,
      reason: `Assigned during promotion to ${change.newTitle ?? "new role"}.`,
    });
  }

  await logAuditEvent({
    action: "ROLE_CHANGED",
    actorId: session.id,
    targetType: "User",
    targetId: input.userId,
    description:
      `Promotion: ${state.title ?? "—"} → ${change.newTitle ?? "—"}` +
      ` (level ${preview.levelFrom ?? "?"} → ${preview.levelTo ?? "?"}), ` +
      `effective ${change.effectiveDate}` +
      `${change.reason ? ` — ${change.reason}` : ""}`,
  });

  revalidatePath(`/people/${input.userId}`);

  return { applied: true, setupComplete: preview.setupComplete, preview };
}

/** Mark a promotion's new-role setup as complete (clears it from the queue). */
export async function markPromotionSetupComplete(promotionRecordId: string): Promise<void> {
  const session = await requireSessionUser();
  if (!officerish(session)) throw new Error("Unauthorized");
  await prisma.promotionRecord.update({
    where: { id: promotionRecordId },
    data: { setupComplete: true, pendingSetup: JSON.stringify([]) },
  });
}
