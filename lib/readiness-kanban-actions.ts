"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import type {
  TrainingEvidenceStatus,
  ClassOfferingApprovalStatus,
  InterviewGateStatus,
} from "@prisma/client";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false as const, error: "Unauthorized" };
  }
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return { success: false as const, error: "Unauthorized - Admin access required" };
  }
  return { success: true as const, userId: session.user.id };
}

const VALID_EVIDENCE_STATUSES: TrainingEvidenceStatus[] = [
  "PENDING_REVIEW",
  "APPROVED",
  "REVISION_REQUESTED",
  "REJECTED",
];

const VALID_APPROVAL_STATUSES: ClassOfferingApprovalStatus[] = [
  "NOT_REQUESTED",
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED",
];

const VALID_INTERVIEW_STATUSES: InterviewGateStatus[] = [
  "REQUIRED",
  "SCHEDULED",
  "COMPLETED",
  "PASSED",
  "HOLD",
  "FAILED",
  "WAIVED",
];

export async function updateEvidenceStatus(
  submissionId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    if (!VALID_EVIDENCE_STATUSES.includes(newStatus as TrainingEvidenceStatus)) {
      return { success: false, error: "Invalid evidence status" };
    }

    await prisma.trainingEvidenceSubmission.update({
      where: { id: submissionId },
      data: {
        status: newStatus as TrainingEvidenceStatus,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
      },
    });

    revalidatePath("/admin/instructor-readiness");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function updateOfferingApprovalStatus(
  approvalId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    if (!VALID_APPROVAL_STATUSES.includes(newStatus as ClassOfferingApprovalStatus)) {
      return { success: false, error: "Invalid approval status" };
    }

    const data: Record<string, unknown> = {
      status: newStatus as ClassOfferingApprovalStatus,
    };

    if (["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(newStatus)) {
      data.reviewedById = auth.userId;
      data.reviewedAt = new Date();
    }

    await prisma.classOfferingApproval.update({
      where: { id: approvalId },
      data,
    });

    revalidatePath("/admin/instructor-readiness");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function updateInterviewGateStatus(
  gateId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    if (!VALID_INTERVIEW_STATUSES.includes(newStatus as InterviewGateStatus)) {
      return { success: false, error: "Invalid interview gate status" };
    }

    const data: Record<string, unknown> = {
      status: newStatus as InterviewGateStatus,
    };

    if (newStatus === "PASSED" || newStatus === "FAILED") {
      data.reviewedById = auth.userId;
      data.reviewedAt = new Date();
      data.completedAt = new Date();
    }

    await prisma.instructorInterviewGate.update({
      where: { id: gateId },
      data,
    });

    revalidatePath("/admin/instructor-readiness");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
