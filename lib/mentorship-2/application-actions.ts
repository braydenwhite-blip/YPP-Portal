"use server";

/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M1) — mentee application intake.
 *
 * Closes the audit's "no application/intake stage" gap: mentees can apply for
 * mentorship (today they are only assigned). Officers review applications and
 * record an outcome. Gated by ENABLE_MENTORSHIP_2.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireSessionUser, requireOfficer } from "@/lib/authorization";
import { isMentorship2Enabled } from "@/lib/feature-flags";
import {
  canTransitionApplication,
  isMentorshipApplicationStatus,
  isTerminalApplicationStatus,
  type MentorshipApplicationStatus,
} from "./constants";

function ensureEnabled() {
  if (!isMentorship2Enabled()) {
    throw new Error("Mentorship 2.0 is not enabled");
  }
}

const SubmitSchema = z.object({
  programGroup: z.enum(["OFFICER", "INSTRUCTOR", "STUDENT"]).optional(),
  goals: z.string().trim().max(2000).optional(),
  interests: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  preferredExpertise: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  availability: z.string().trim().max(500).optional(),
  motivation: z.string().trim().max(2000).optional(),
});

/**
 * Submit a mentorship application for the signed-in user. Rejects a second open
 * application so the queue holds at most one live request per mentee.
 */
export async function submitMentorshipApplication(
  input: z.infer<typeof SubmitSchema>
) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = SubmitSchema.parse(input);

  const existingOpen = await prisma.mentorshipApplication.findFirst({
    where: { applicantId: session.id, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
    select: { id: true },
  });
  if (existingOpen) {
    throw new Error("You already have an open mentorship application.");
  }

  const row = await prisma.mentorshipApplication.create({
    data: {
      applicantId: session.id,
      programGroup: data.programGroup ?? "STUDENT",
      goals: data.goals || null,
      interests: data.interests ?? [],
      preferredExpertise: data.preferredExpertise ?? [],
      availability: data.availability || null,
      motivation: data.motivation || null,
    },
  });

  revalidatePath("/mentorship");
  return row;
}

/** A mentee withdraws their own still-open application. */
export async function withdrawMentorshipApplication(applicationId: string) {
  ensureEnabled();
  const session = await requireSessionUser();

  const app = await prisma.mentorshipApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, applicantId: true, status: true },
  });
  if (!app || app.applicantId !== session.id) {
    throw new Error("Not found");
  }
  const from = app.status as MentorshipApplicationStatus;
  if (!canTransitionApplication(from, "WITHDRAWN")) {
    throw new Error("This application can no longer be withdrawn.");
  }

  const row = await prisma.mentorshipApplication.update({
    where: { id: applicationId },
    data: { status: "WITHDRAWN", decidedAt: new Date() },
  });

  revalidatePath("/mentorship");
  return row;
}

const ReviewSchema = z.object({
  applicationId: z.string().min(1),
  status: z.string().min(1),
  reviewNotes: z.string().trim().max(2000).optional(),
  matchedMentorshipId: z.string().min(1).optional(),
});

/**
 * Officer review: advance an application's status (with a legal-transition check)
 * and stamp the reviewer + decision time. When matching, the resulting mentorship
 * id may be recorded for traceability.
 */
export async function reviewMentorshipApplication(
  input: z.infer<typeof ReviewSchema>
) {
  ensureEnabled();
  const session = await requireOfficer();
  const { applicationId, status, reviewNotes, matchedMentorshipId } =
    ReviewSchema.parse(input);

  if (!isMentorshipApplicationStatus(status)) {
    throw new Error("Invalid status");
  }

  const app = await prisma.mentorshipApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true },
  });
  if (!app) {
    throw new Error("Not found");
  }
  const from = app.status as MentorshipApplicationStatus;
  if (!canTransitionApplication(from, status)) {
    throw new Error(`Cannot move application from ${from} to ${status}.`);
  }

  const row = await prisma.mentorshipApplication.update({
    where: { id: applicationId },
    data: {
      status,
      reviewerId: session.id,
      reviewNotes: reviewNotes || null,
      matchedMentorshipId:
        status === "MATCHED" ? matchedMentorshipId || null : null,
      decidedAt: isTerminalApplicationStatus(status) ? new Date() : null,
    },
  });

  revalidatePath("/admin/mentorship");
  return row;
}
