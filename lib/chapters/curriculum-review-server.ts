"use server";

// Chapter OS Phase 4 — the REAL two-stage curriculum approval mutations. The
// instructor submits, the Chapter President reviews (approve / request revision),
// the CP escalates a CP-approved curriculum to global leadership, and global
// leadership gives the final sign-off (or sends it back). Only a true global
// approval (FULLY_APPROVED) satisfies launch readiness.
//
// Every transition is validated against the pure state machine in
// `curriculum-review.ts`, authorized with the chapter guards, and recorded on the
// CurriculumApproval satellite + an append-only CurriculumReviewEvent. The legacy
// single-stage `ClassTemplate.submissionStatus` is kept in sync for the rest of
// the portal. Guarded by a capability check so it degrades cleanly pre-migration.

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authorization";
import { requireChapterManager, requireChapterLeadership } from "@/lib/chapters/access";
import { isOnInstructionCommittee } from "@/lib/org/committees";
import type { SessionUser } from "@/lib/authorization-roles";
import {
  CurriculumReviewActionSchema,
  GlobalCurriculumReviewSchema,
} from "@/lib/chapters/room-actions";
import {
  nextCurriculumStage,
  legacyInitialStage,
  legacySubmissionStatusForStage,
  CURRICULUM_ACTION_AUTHORITY,
  CURRICULUM_ACTION_DECISION,
  type CurriculumReviewAction,
  type CurriculumApprovalStage,
} from "@/lib/chapters/curriculum-review";
import { hasCurriculumApprovalWorkflow } from "@/lib/chapters/curriculum-approval-compat";

export type CurriculumReviewResult =
  | { ok: true; stage: CurriculumApprovalStage }
  | { ok: false; error: string };

type TransitionInput = { chapterId: string; classTemplateId: string; notes?: string };

/**
 * The single engine every public action funnels through: capability check →
 * load template → authorize by the action's authority level (with a self-approval
 * guard) → validate the transition → write the approval + audit event + legacy
 * status sync → revalidate.
 */
async function runCurriculumTransition(
  input: TransitionInput,
  action: CurriculumReviewAction
): Promise<CurriculumReviewResult> {
  if (!(await hasCurriculumApprovalWorkflow())) {
    return {
      ok: false,
      error: "Two-stage curriculum approval will be available after the latest database migration is applied.",
    };
  }

  const template = await prisma.classTemplate.findUnique({
    where: { id: input.classTemplateId },
    select: {
      id: true,
      chapterId: true,
      createdById: true,
      submissionStatus: true,
      curriculumApproval: { select: { id: true, stage: true } },
    },
  });
  if (!template) return { ok: false, error: "Curriculum not found" };
  if (template.chapterId !== input.chapterId) {
    return { ok: false, error: "Curriculum not in this chapter" };
  }

  // --- Authorize by the action's required authority ------------------------
  const authority = CURRICULUM_ACTION_AUTHORITY[action];
  let viewer: SessionUser;
  let actorRole: string;
  try {
    if (authority === "global_leadership") {
      try {
        viewer = await requireChapterLeadership();
      } catch (err) {
        // National leadership isn't the only route to global sign-off: an
        // active Instruction Committee member can also finalize curricula,
        // independent of their title/ladder level.
        const user = await requireSessionUser();
        if (!(await isOnInstructionCommittee(user.id))) throw err;
        viewer = user;
      }
      actorRole = "GLOBAL_LEADERSHIP";
    } else if (authority === "chapter_president") {
      const { user, isLeadership } = await requireChapterManager(input.chapterId);
      viewer = user;
      actorRole = isLeadership ? "GLOBAL_LEADERSHIP" : "CHAPTER_PRESIDENT";
      // A Chapter President cannot approve / advance their OWN authored
      // curriculum — another reviewer (or national leadership) must.
      if (!isLeadership && template.createdById === user.id) {
        return { ok: false, error: "You can't approve your own curriculum — another reviewer must." };
      }
    } else {
      // authority === "author": the instructor who wrote it, or a chapter manager.
      const user = await requireSessionUser();
      const isAuthor = template.createdById === user.id;
      let isManager = false;
      try {
        await requireChapterManager(input.chapterId);
        isManager = true;
      } catch {
        isManager = false;
      }
      if (!isAuthor && !isManager) return { ok: false, error: "Unauthorized" };
      viewer = user;
      actorRole = isAuthor ? "INSTRUCTOR" : "CHAPTER_PRESIDENT";
    }
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  // --- Validate the transition against the pure state machine ---------------
  const currentStage: CurriculumApprovalStage =
    (template.curriculumApproval?.stage as CurriculumApprovalStage | undefined) ??
    legacyInitialStage(template.submissionStatus);
  const newStage = nextCurriculumStage(currentStage, action);
  if (!newStage) {
    return { ok: false, error: "That step isn't available from the curriculum's current stage." };
  }

  const now = new Date();
  const actorName = viewer.name ?? viewer.email ?? null;
  const notes = input.notes?.trim() ? input.notes.trim() : null;

  // Stage-specific fields written onto the approval satellite.
  const approvalData: Record<string, unknown> = { stage: newStage };
  switch (action) {
    case "submit_for_cp_review":
      approvalData.submittedAt = now;
      break;
    case "cp_request_revision":
    case "cp_approve":
      approvalData.cpReviewedById = viewer.id;
      approvalData.cpReviewedByName = actorName;
      approvalData.cpReviewedAt = now;
      approvalData.cpReviewNotes = notes;
      break;
    case "send_to_global":
      approvalData.sentToGlobalAt = now;
      break;
    case "global_approve":
    case "global_request_revision":
      approvalData.globalReviewedById = viewer.id;
      approvalData.globalReviewedByName = actorName;
      approvalData.globalReviewedAt = now;
      approvalData.globalReviewNotes = notes;
      break;
  }

  const decision = CURRICULUM_ACTION_DECISION[action];
  const legacyStatus = legacySubmissionStatusForStage(newStage);

  try {
    await prisma.$transaction(async (tx) => {
      const approval = await tx.curriculumApproval.upsert({
        where: { classTemplateId: input.classTemplateId },
        create: { classTemplateId: input.classTemplateId, ...approvalData },
        update: approvalData,
        select: { id: true },
      });
      await tx.curriculumReviewEvent.create({
        data: {
          approvalId: approval.id,
          actorId: viewer.id,
          actorName,
          actorRole,
          stage: newStage,
          decision,
          notes,
        },
      });
      // Keep the legacy single-stage field coherent for the catalog / workspace.
      await tx.classTemplate.update({
        where: { id: input.classTemplateId },
        data: {
          submissionStatus: legacyStatus,
          ...(action === "submit_for_cp_review" ? { submittedAt: now } : {}),
          ...(action === "cp_approve" || action === "cp_request_revision"
            ? { reviewedById: viewer.id, reviewNotes: notes }
            : {}),
        },
      });
    });
  } catch {
    return { ok: false, error: "Could not save the curriculum review" };
  }

  revalidatePath("/chapter");
  revalidatePath("/admin/curricula");
  revalidatePath("/instructor/workspace");
  return { ok: true, stage: newStage };
}

function parseAction(input: unknown): TransitionInput | null {
  const parsed = CurriculumReviewActionSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/** Instructor (or CP on their behalf) submits a curriculum into CP review. */
export async function submitCurriculumForCpReview(input: unknown): Promise<CurriculumReviewResult> {
  const data = parseAction(input);
  if (!data) return { ok: false, error: "Invalid input" };
  return runCurriculumTransition(data, "submit_for_cp_review");
}

/** Chapter President sends a submitted curriculum back to the instructor. */
export async function cpRequestCurriculumRevision(input: unknown): Promise<CurriculumReviewResult> {
  const data = parseAction(input);
  if (!data) return { ok: false, error: "Invalid input" };
  if (!data.notes?.trim()) return { ok: false, error: "Revision notes are required." };
  return runCurriculumTransition(data, "cp_request_revision");
}

/** Chapter President marks a submitted curriculum CP-approved. */
export async function cpApproveCurriculum(input: unknown): Promise<CurriculumReviewResult> {
  const data = parseAction(input);
  if (!data) return { ok: false, error: "Invalid input" };
  return runCurriculumTransition(data, "cp_approve");
}

/** Chapter President escalates a CP-approved curriculum to global review. */
export async function sendCurriculumToGlobalReview(input: unknown): Promise<CurriculumReviewResult> {
  const data = parseAction(input);
  if (!data) return { ok: false, error: "Invalid input" };
  return runCurriculumTransition(data, "send_to_global");
}

/** Global leadership gives the final sign-off (one-click from the room). */
export async function globalApproveCurriculum(input: unknown): Promise<CurriculumReviewResult> {
  const data = parseAction(input);
  if (!data) return { ok: false, error: "Invalid input" };
  return runCurriculumTransition(data, "global_approve");
}

/** Global leadership sends a curriculum back for revision (notes required). */
export async function globalRequestCurriculumRevision(input: unknown): Promise<CurriculumReviewResult> {
  const data = parseAction(input);
  if (!data) return { ok: false, error: "Invalid input" };
  if (!data.notes?.trim()) return { ok: false, error: "Revision notes are required." };
  return runCurriculumTransition(data, "global_request_revision");
}

/** Combined global decision (approve | request_revision) for a richer surface. */
export async function submitGlobalCurriculumReview(input: unknown): Promise<CurriculumReviewResult> {
  const parsed = GlobalCurriculumReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { decision, ...rest } = parsed.data;
  if (decision === "request_revision" && !rest.notes?.trim()) {
    return { ok: false, error: "Revision notes are required." };
  }
  return runCurriculumTransition(rest, decision === "approve" ? "global_approve" : "global_request_revision");
}
