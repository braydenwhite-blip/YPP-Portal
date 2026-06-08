"use server";

import { revalidatePath } from "next/cache";
import type {
  ClassOutcomeStatus,
  ClassRepeatRecommendation,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, requireAnyRole } from "@/lib/authorization";
import { recordOfferingTimeline } from "@/lib/class-offering-timeline";
import {
  OUTCOME_STATUS_LABELS,
  OUTCOME_STATUS_ORDER,
  REPEAT_RECOMMENDATION_LABELS,
  REPEAT_RECOMMENDATION_ORDER,
} from "@/lib/class-feedback-constants";

/**
 * Mutations for the class feedback + completion-outcome layer.
 *
 *   • submitClassFeedback        — STUDENT, for a class they took that has ended.
 *   • submitInstructorReflection — the owning INSTRUCTOR (or ADMIN).
 *   • setClassAdminOutcome       — ADMIN only; records the completion outcome and
 *                                  repeat recommendation, and journals a timeline note.
 *
 * Each action enforces its own authorization server-side so direct calls cannot
 * bypass UI gating. Reads live in lib/class-feedback.ts.
 */

function getString(formData: FormData, key: string, required = true): string {
  const raw = formData.get(key);
  const value = raw == null ? "" : String(raw).trim();
  if (required && !value) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value;
}

function getOptionalText(formData: FormData, key: string): string | null {
  const value = getString(formData, key, false);
  return value.length > 0 ? value : null;
}

// A tri-state yes/no/unanswered control. "" / missing → null.
function getTriStateBoolean(formData: FormData, key: string): boolean | null {
  const raw = formData.get(key);
  if (raw == null) return null;
  const value = String(raw).trim().toLowerCase();
  if (value === "yes" || value === "true") return true;
  if (value === "no" || value === "false") return false;
  return null;
}

function getCheckbox(formData: FormData, key: string): boolean {
  const raw = formData.get(key);
  if (raw == null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === "on" || value === "true" || value === "yes" || value === "1";
}

/**
 * Student leaves feedback on a class they took. Allowed once the class has
 * wrapped up (status COMPLETED or end date passed) and only by someone who was
 * actually enrolled. Idempotent: re-submitting updates the existing row.
 */
export async function submitClassFeedback(formData: FormData) {
  const user = await requireSessionUser();
  const offeringId = getString(formData, "offeringId");

  const ratingRaw = parseInt(String(formData.get("rating") ?? ""), 10);
  if (!Number.isFinite(ratingRaw) || ratingRaw < 1 || ratingRaw > 5) {
    throw new Error("Please choose a rating from 1 to 5 stars.");
  }
  const rating = ratingRaw;
  const liked = getOptionalText(formData, "liked");
  const improve = getOptionalText(formData, "improve");
  const wouldRecommend = getTriStateBoolean(formData, "wouldRecommend");

  const enrollment = await prisma.classEnrollment.findUnique({
    where: {
      studentId_offeringId: { studentId: user.id, offeringId },
    },
    select: {
      status: true,
      offering: { select: { status: true, endDate: true } },
    },
  });

  if (!enrollment) {
    throw new Error("You can only leave feedback for a class you took.");
  }
  if (enrollment.status === "WAITLISTED" || enrollment.status === "DROPPED") {
    throw new Error("You can only leave feedback for a class you took.");
  }

  const offering = enrollment.offering;
  const classHasEnded =
    offering.status === "COMPLETED" || offering.endDate.getTime() < Date.now();
  if (!classHasEnded) {
    throw new Error("You can leave feedback once your class has wrapped up.");
  }

  await prisma.classFeedback.upsert({
    where: { offeringId_studentId: { offeringId, studentId: user.id } },
    create: { offeringId, studentId: user.id, rating, liked, improve, wouldRecommend },
    update: { rating, liked, improve, wouldRecommend },
  });

  revalidatePath("/my-classes");
  revalidatePath(`/curriculum/${offeringId}`);
  revalidatePath(`/admin/classes/${offeringId}`);
  revalidatePath("/admin/classes/reports");
  return { success: true };
}

/**
 * The owning instructor (or an admin) records their wrap-up reflection on the
 * class. Stored on the shared ClassOutcome row for the offering. Idempotent.
 */
export async function submitInstructorReflection(formData: FormData) {
  const user = await requireAnyRole(["INSTRUCTOR", "ADMIN"]);
  const offeringId = getString(formData, "offeringId");

  const offering = await prisma.classOffering.findUnique({
    where: { id: offeringId },
    select: { instructorId: true },
  });
  if (!offering) {
    throw new Error("Class offering not found.");
  }
  const isAdmin = user.roles.includes("ADMIN");
  if (offering.instructorId !== user.id && !isAdmin) {
    throw new Error("Only the class instructor can record this reflection.");
  }

  const wentWell = getOptionalText(formData, "wentWell");
  const challenges = getOptionalText(formData, "challenges");
  const studentImpact = getOptionalText(formData, "studentImpact");
  const wouldTeachAgain = getTriStateBoolean(formData, "wouldTeachAgain");

  if (!wentWell && !challenges && !studentImpact && wouldTeachAgain == null) {
    throw new Error("Add at least one note before saving your reflection.");
  }

  const reflectedAt = new Date();
  await prisma.classOutcome.upsert({
    where: { offeringId },
    create: {
      offeringId,
      instructorId: user.id,
      instructorWentWell: wentWell,
      instructorChallenges: challenges,
      instructorStudentImpact: studentImpact,
      instructorWouldTeachAgain: wouldTeachAgain,
      instructorReflectedAt: reflectedAt,
    },
    update: {
      instructorId: user.id,
      instructorWentWell: wentWell,
      instructorChallenges: challenges,
      instructorStudentImpact: studentImpact,
      instructorWouldTeachAgain: wouldTeachAgain,
      instructorReflectedAt: reflectedAt,
    },
  });

  revalidatePath(`/curriculum/${offeringId}`);
  revalidatePath(`/admin/classes/${offeringId}`);
  revalidatePath("/admin/classes/reports");
  return { success: true };
}

function parseOutcomeStatus(value: string): ClassOutcomeStatus {
  if ((OUTCOME_STATUS_ORDER as string[]).includes(value)) {
    return value as ClassOutcomeStatus;
  }
  throw new Error(`Invalid outcome status: ${value}`);
}

function parseRepeatRecommendation(
  value: string,
): ClassRepeatRecommendation | null {
  if (value === "") return null;
  if ((REPEAT_RECOMMENDATION_ORDER as string[]).includes(value)) {
    return value as ClassRepeatRecommendation;
  }
  throw new Error(`Invalid repeat recommendation: ${value}`);
}

/**
 * Admin records the class completion outcome: an overall verdict, a
 * repeat-recommendation, an optional "got good feedback" flag, and notes.
 * Journals a NOTE to the offering timeline so the decision is auditable.
 */
export async function setClassAdminOutcome(formData: FormData) {
  const actor = await requireAnyRole(["ADMIN"]);
  const offeringId = getString(formData, "offeringId");

  const offering = await prisma.classOffering.findUnique({
    where: { id: offeringId },
    select: { id: true },
  });
  if (!offering) {
    throw new Error("Class offering not found.");
  }

  const status = parseOutcomeStatus(getString(formData, "status"));
  const repeatRecommendation = parseRepeatRecommendation(
    getString(formData, "repeatRecommendation", false),
  );
  const gotGoodFeedback = getCheckbox(formData, "gotGoodFeedback");
  const adminNotes = getOptionalText(formData, "adminNotes");
  const recordedAt = new Date();

  await prisma.classOutcome.upsert({
    where: { offeringId },
    create: {
      offeringId,
      status,
      repeatRecommendation,
      gotGoodFeedback,
      adminNotes,
      recordedById: actor.id,
      recordedAt,
    },
    update: {
      status,
      repeatRecommendation,
      gotGoodFeedback,
      adminNotes,
      recordedById: actor.id,
      recordedAt,
    },
  });

  const summaryParts = [`Class outcome: ${OUTCOME_STATUS_LABELS[status]}`];
  if (repeatRecommendation) {
    summaryParts.push(REPEAT_RECOMMENDATION_LABELS[repeatRecommendation]);
  }
  if (gotGoodFeedback) {
    summaryParts.push("flagged: got good feedback");
  }

  await recordOfferingTimeline({
    offeringId,
    actorId: actor.id,
    kind: "NOTE",
    summary: `${summaryParts.join(" · ")}.`,
    payload: {
      status,
      repeatRecommendation,
      gotGoodFeedback,
    },
  });

  revalidatePath(`/admin/classes/${offeringId}`);
  revalidatePath("/admin/classes/reports");
  revalidatePath(`/curriculum/${offeringId}`);
  return { success: true };
}
