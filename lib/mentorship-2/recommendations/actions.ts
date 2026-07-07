"use server";

/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M2) — recommendation data layer.
 *
 * Generates scored mentor recommendations for a mentee application and lets
 * officers shortlist / hold / reject / approve them. Approving creates or
 * connects the canonical Mentorship pair, supersedes the competing
 * recommendations, and closes the application as MATCHED.
 *
 * All writes are gated by ENABLE_MENTORSHIP_2 and authorized to officer-tier
 * users (requireOfficer). Generation is idempotent — re-running upserts on the
 * (application, mentor) pair and never resets an admin's decision.
 */

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireOfficer } from "@/lib/authorization";
import { isMentorship2Enabled } from "@/lib/feature-flags";
import { onMentorMatched } from "@/lib/growth/integrations";
import {
  ACTIVE_RECOMMENDATION_STATUSES,
  canTransitionRecommendation,
  isOpenApplicationStatus,
  type MentorshipApplicationStatus,
  type MentorshipRecommendationStatus,
} from "../constants";
import { topRecommendations } from "../matching/rank";
import { buildApplicationInput } from "./inputs";
import {
  getEligibleMentors,
  listRecommendationsForApplication,
} from "./queries";

/** How many top-ranked mentors to persist as SUGGESTED per generation run. */
const MAX_RECOMMENDATIONS = 8;

function ensureEnabled() {
  if (!isMentorship2Enabled()) {
    throw new Error("Mentorship 2.0 is not enabled");
  }
}

function revalidateApplication(applicationId: string) {
  revalidatePath(`/admin/mentorship/applications/${applicationId}`);
  revalidatePath("/admin/mentorship/applications");
}

/**
 * Score the eligible mentor pool against an application and persist the top
 * candidates as SUGGESTED recommendations. Idempotent: an existing (application,
 * mentor) row has its score/breakdown refreshed; a row the admin has already
 * acted on (SHORTLISTED/HELD/REJECTED/APPROVED) keeps its status. Moves a
 * SUBMITTED application into UNDER_REVIEW on first generation.
 */
export async function generateRecommendationsForApplication(applicationId: string) {
  ensureEnabled();
  await requireOfficer();

  const application = await prisma.mentorshipApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      applicantId: true,
      status: true,
      goals: true,
      interests: true,
      preferredExpertise: true,
      availability: true,
      applicant: {
        select: {
          profile: {
            select: { careerGoal: true, leadershipGoal: true, grade: true },
          },
        },
      },
    },
  });
  if (!application) throw new Error("Not found");

  const status = application.status as MentorshipApplicationStatus;
  if (!isOpenApplicationStatus(status)) {
    throw new Error(
      "Recommendations can only be generated for an open application."
    );
  }

  const taxonomy = await prisma.expertiseArea.findMany({
    where: { isActive: true },
    select: { slug: true, name: true },
  });

  const input = buildApplicationInput(application, taxonomy);
  const mentors = await getEligibleMentors({ excludeUserId: application.applicantId });
  const ranked = topRecommendations(input, mentors, MAX_RECOMMENDATIONS);

  await prisma.$transaction(async (tx) => {
    if (status === "SUBMITTED") {
      await tx.mentorshipApplication.update({
        where: { id: applicationId },
        data: { status: "UNDER_REVIEW" },
      });
    }

    for (const candidate of ranked) {
      const breakdownJson =
        candidate.breakdown as unknown as Prisma.InputJsonValue;
      const existing = await tx.mentorshipMatchRecommendation.findUnique({
        where: {
          mentorshipApplicationId_mentorUserId: {
            mentorshipApplicationId: applicationId,
            mentorUserId: candidate.mentorUserId,
          },
        },
        select: { id: true, status: true },
      });

      if (!existing) {
        await tx.mentorshipMatchRecommendation.create({
          data: {
            mentorshipApplicationId: applicationId,
            menteeUserId: application.applicantId,
            mentorUserId: candidate.mentorUserId,
            score: candidate.score,
            scoreBreakdownJson: breakdownJson,
            status: "SUGGESTED",
          },
        });
        continue;
      }

      // Refresh the score; only revive status when it was never acted on (or was
      // superseded by a now-undone approval). Never clobber an admin decision.
      const reviveable =
        existing.status === "SUGGESTED" || existing.status === "SUPERSEDED";
      await tx.mentorshipMatchRecommendation.update({
        where: { id: existing.id },
        data: {
          score: candidate.score,
          scoreBreakdownJson: breakdownJson,
          menteeUserId: application.applicantId,
          ...(reviveable ? { status: "SUGGESTED" } : {}),
        },
      });
    }
  });

  revalidateApplication(applicationId);
  return listRecommendationsForApplication(applicationId);
}

/** Shared status-transition write for the non-approval admin actions. */
async function transitionRecommendation(
  recommendationId: string,
  to: MentorshipRecommendationStatus,
  opts?: { note?: string }
) {
  ensureEnabled();
  const session = await requireOfficer();

  const rec = await prisma.mentorshipMatchRecommendation.findUnique({
    where: { id: recommendationId },
    select: { id: true, status: true, mentorshipApplicationId: true },
  });
  if (!rec) throw new Error("Not found");

  const from = rec.status as MentorshipRecommendationStatus;
  if (!canTransitionRecommendation(from, to)) {
    throw new Error(`Cannot move recommendation from ${from} to ${to}.`);
  }

  const updated = await prisma.mentorshipMatchRecommendation.update({
    where: { id: recommendationId },
    data: {
      status: to,
      ...(opts?.note !== undefined ? { adminNote: opts.note.trim() || null } : {}),
      decidedAt: new Date(),
      decidedByUserId: session.id,
    },
  });

  revalidateApplication(rec.mentorshipApplicationId);
  return updated;
}

/** Flag a recommendation as a finalist. */
export async function shortlistRecommendation(recommendationId: string) {
  return transitionRecommendation(recommendationId, "SHORTLISTED");
}

/** Park a recommendation for later without rejecting it. */
export async function holdRecommendation(recommendationId: string) {
  return transitionRecommendation(recommendationId, "HELD");
}

/** Rule a recommendation out, preserving the admin's note. */
export async function rejectRecommendation(
  recommendationId: string,
  note?: string
) {
  return transitionRecommendation(recommendationId, "REJECTED", { note });
}

/** Supersede every still-active recommendation for an application except one. */
async function supersedeSiblings(
  client: Prisma.TransactionClient,
  applicationId: string,
  keepRecommendationId: string
) {
  await client.mentorshipMatchRecommendation.updateMany({
    where: {
      mentorshipApplicationId: applicationId,
      id: { not: keepRecommendationId },
      status: { in: [...ACTIVE_RECOMMENDATION_STATUSES] },
    },
    data: { status: "SUPERSEDED" },
  });
}

/**
 * Standalone supersede (the rest are superseded automatically by approve). Kept
 * exported per the slice spec for admin tooling / recovery.
 */
export async function supersedeOtherRecommendations(
  applicationId: string,
  approvedRecommendationId: string
) {
  ensureEnabled();
  await requireOfficer();
  await supersedeSiblings(prisma, applicationId, approvedRecommendationId);
  revalidateApplication(applicationId);
}

/**
 * Approve a recommendation as the active match. In one transaction: create or
 * connect the canonical Mentorship pair, mark this recommendation APPROVED,
 * supersede the competing recommendations, and close the application as MATCHED.
 */
export async function approveRecommendation(
  recommendationId: string,
  note?: string
) {
  ensureEnabled();
  const session = await requireOfficer();

  const rec = await prisma.mentorshipMatchRecommendation.findUnique({
    where: { id: recommendationId },
    include: {
      application: {
        select: {
          id: true,
          status: true,
          programGroup: true,
          matchedMentorshipId: true,
        },
      },
    },
  });
  if (!rec) throw new Error("Not found");

  const from = rec.status as MentorshipRecommendationStatus;
  if (!canTransitionRecommendation(from, "APPROVED")) {
    throw new Error(`Cannot approve a recommendation in ${from} status.`);
  }

  const application = rec.application;
  if (!isOpenApplicationStatus(application.status as MentorshipApplicationStatus)) {
    throw new Error("This application is already closed.");
  }

  // Officers mentor mentees as the instructor tier; students are mentored as
  // STUDENT-type pairs. (MentorshipType has no OFFICER variant.)
  const mentorshipType =
    application.programGroup === "STUDENT" ? "STUDENT" : "INSTRUCTOR";

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create or connect the canonical Mentorship pair.
    const existing = application.matchedMentorshipId
      ? await tx.mentorship.findUnique({
          where: { id: application.matchedMentorshipId },
          select: { id: true },
        })
      : null;

    const mentorship = existing
      ? await tx.mentorship.update({
          where: { id: existing.id },
          data: {
            mentorId: rec.mentorUserId,
            menteeId: rec.menteeUserId,
            status: "ACTIVE",
          },
        })
      : await tx.mentorship.create({
          data: {
            mentorId: rec.mentorUserId,
            menteeId: rec.menteeUserId,
            type: mentorshipType,
            programGroup: application.programGroup,
            status: "ACTIVE",
          },
        });

    // 2. Approve this recommendation (preserve note if none supplied).
    const approved = await tx.mentorshipMatchRecommendation.update({
      where: { id: rec.id },
      data: {
        status: "APPROVED",
        ...(note !== undefined ? { adminNote: note.trim() || null } : {}),
        decidedAt: new Date(),
        decidedByUserId: session.id,
      },
    });

    // 3. Supersede the competing recommendations.
    await supersedeSiblings(tx, application.id, rec.id);

    // 4. Close the application as MATCHED.
    await tx.mentorshipApplication.update({
      where: { id: application.id },
      data: {
        status: "MATCHED",
        matchedMentorshipId: mentorship.id,
        reviewerId: session.id,
        decidedAt: new Date(),
      },
    });

    return { recommendation: approved, mentorship };
  });

  revalidateApplication(application.id);
  revalidatePath("/mentorship");
  revalidatePath("/mentorship");

  // Growth Engine (Phase N1): seed the mentee's Vision -> Goal -> Milestone ->
  // Action hierarchy from the M2 bridge and emit MENTOR_MATCHED. Flag-gated +
  // best-effort — never breaks the match flow.
  await onMentorMatched(rec.menteeUserId, result.mentorship.id);

  return result;
}
