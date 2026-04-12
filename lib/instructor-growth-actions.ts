"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";

import { getSession } from "@/lib/auth-supabase";
import { logAuditEvent } from "@/lib/audit-log-actions";
import {
  canReviewInstructorGrowth,
  revokeInstructorGrowthEvent,
  reviewInstructorGrowthClaim,
  submitInstructorGrowthClaim,
} from "@/lib/instructor-growth-service";

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return value ? String(value).trim() : "";
}

function parseDateInput(raw: string) {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Please use a valid date.");
  }
  return date;
}

function revalidateInstructorGrowthPaths(instructorId: string) {
  revalidatePath("/instructor-growth");
  revalidatePath(`/instructor-growth/${instructorId}`);
  revalidatePath("/instructor-growth/review");
  revalidatePath("/instructor/workspace");
  revalidatePath("/instructor/certifications");
  revalidatePath(`/mentorship/mentees/${instructorId}`);
}

async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function submitInstructorGrowthClaimAction(formData: FormData) {
  const session = await requireSession();
  const instructorId = getString(formData, "instructorId");
  const returnTo = getString(formData, "returnTo", false) || "/instructor-growth";

  if (session.user.id !== instructorId) {
    throw new Error("You can only submit claims for your own instructor record.");
  }
  if (
    !session.user.roles.includes("INSTRUCTOR") &&
    !session.user.roles.includes("CHAPTER_PRESIDENT") &&
    !session.user.roles.includes("ADMIN")
  ) {
    throw new Error("Instructor access is required.");
  }

  const eventKey = getString(formData, "eventKey");
  const claimDate = parseDateInput(getString(formData, "claimDate"));
  const claimContext = getString(formData, "claimContext");
  const evidenceUrl = getOptionalString(formData, "evidenceUrl") || null;
  const relatedUserId = getOptionalString(formData, "relatedUserId") || null;

  const created = await submitInstructorGrowthClaim({
    instructorId,
    submittedById: session.user.id,
    eventKey,
    claimDate,
    claimContext,
    evidenceUrl,
    relatedUserId,
  });

  revalidateInstructorGrowthPaths(instructorId);

  await logAuditEvent({
    action: AuditAction.INSTRUCTOR_GROWTH_CLAIM_SUBMITTED,
    actorId: session.user.id,
    targetType: "InstructorGrowthEvent",
    targetId: created.id,
    description: `Submitted instructor growth claim ${eventKey} for ${instructorId}.`,
    metadata: {
      instructorId,
      eventKey,
      assignedMentorId: created.assignedMentorId,
    },
  });

  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}status=claim-submitted`);
}

export async function reviewInstructorGrowthClaimAction(formData: FormData) {
  const session = await requireSession();
  const eventId = getString(formData, "eventId");
  const instructorId = getString(formData, "instructorId");
  const decision = getString(formData, "decision") as "APPROVED" | "REJECTED";
  const reviewNotes = getOptionalString(formData, "reviewNotes") || null;
  const returnTo = getString(formData, "returnTo", false) || "/instructor-growth/review";

  const canReview = await canReviewInstructorGrowth(
    {
      userId: session.user.id,
      roles: session.user.roles,
      chapterId: session.user.chapterId,
    },
    instructorId
  );
  if (!canReview) {
    throw new Error("You do not have access to review this instructor's claims.");
  }

  const updated = await reviewInstructorGrowthClaim({
    eventId,
    reviewerId: session.user.id,
    decision,
    reviewNotes,
  });

  revalidateInstructorGrowthPaths(instructorId);

  await logAuditEvent({
    action:
      decision === "APPROVED"
        ? AuditAction.INSTRUCTOR_GROWTH_CLAIM_APPROVED
        : AuditAction.INSTRUCTOR_GROWTH_CLAIM_REJECTED,
    actorId: session.user.id,
    targetType: "InstructorGrowthEvent",
    targetId: updated.id,
    description: `${decision === "APPROVED" ? "Approved" : "Rejected"} instructor growth claim ${updated.id} for ${instructorId}.`,
    metadata: {
      instructorId,
      eventId,
      decision,
    },
  });

  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}status=claim-reviewed`);
}

export async function revokeInstructorGrowthEventAction(formData: FormData) {
  const session = await requireSession();
  const eventId = getString(formData, "eventId");
  const instructorId = getString(formData, "instructorId");
  const reason = getString(formData, "reason");
  const returnTo = getString(formData, "returnTo", false) || `/instructor-growth/${instructorId}`;

  const canReview = await canReviewInstructorGrowth(
    {
      userId: session.user.id,
      roles: session.user.roles,
      chapterId: session.user.chapterId,
    },
    instructorId
  );
  if (!canReview) {
    throw new Error("You do not have access to revoke this instructor growth event.");
  }

  const updated = await revokeInstructorGrowthEvent({
    eventId,
    reviewerId: session.user.id,
    reason,
  });

  revalidateInstructorGrowthPaths(instructorId);

  await logAuditEvent({
    action: AuditAction.INSTRUCTOR_GROWTH_EVENT_REVOKED,
    actorId: session.user.id,
    targetType: "InstructorGrowthEvent",
    targetId: updated.id,
    description: `Revoked instructor growth event ${updated.id} for ${instructorId}.`,
    metadata: {
      instructorId,
      eventId,
      reason,
    },
  });

  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}status=claim-revoked`);
}
