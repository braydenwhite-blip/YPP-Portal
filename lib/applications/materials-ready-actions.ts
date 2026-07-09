"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireApplicationReviewerPage } from "@/lib/page-guards";
import {
  assertCanViewApplicant,
  getHiringActor,
} from "@/lib/chapter-hiring-permissions";
import { loadApplicationRecord } from "@/lib/applications/application-record";
import { prisma } from "@/lib/prisma";

const SetMaterialsReadySchema = z.object({
  applicationId: z.string().min(1),
  ready: z.boolean(),
});

export async function setApplicationMaterialsReady(input: unknown) {
  const sessionUser = await requireApplicationReviewerPage();
  const { applicationId, ready } = SetMaterialsReadySchema.parse(input);

  const record = await loadApplicationRecord(applicationId);
  if (!record) {
    return { success: false as const, error: "Application not found." };
  }

  const actor = await getHiringActor(sessionUser.id);
  try {
    assertCanViewApplicant(actor, {
      id: record.id,
      applicantId: record.applicant.id,
      reviewerId: record.reviewer?.id ?? null,
      interviewRound: record.interviewRound,
      applicantChapterId: record.applicant.chapterId,
      interviewerAssignments: record.interviewerAssignments.map((assignment) => ({
        interviewerId: assignment.interviewer.id,
        round: assignment.round,
        removedAt: null,
      })),
    });
  } catch {
    return { success: false as const, error: "Unauthorized." };
  }

  await prisma.instructorApplication.update({
    where: { id: applicationId },
    data: { materialsReadyAt: ready ? new Date() : null },
  });

  revalidatePath(`/admin/instructor-applicants/${applicationId}`);
  return { success: true as const };
}
