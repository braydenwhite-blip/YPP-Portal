"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { RoleType, ChapterPresidentApplicationStatus, HiringRecommendation } from "@prisma/client";
import {
  sendNewApplicationNotification,
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
  sendInfoRequestEmail,
  sendInterviewScheduledEmail,
} from "@/lib/email";
import {
  getLegacyApplicationTransitionError,
  type LegacyApplicationReviewAction,
} from "@/lib/legacy-application-review";
import { syncChapterPresidentApplicationWorkflow } from "@/lib/workflow";
import { CP_STARTER_ACTIONS } from "@/lib/chapter-president-lifecycle";
import { provisionChapterForApproval } from "@/lib/chapters/provisioning";
import { fireEntityStatusChanged } from "@/lib/workflow-engine/triggers";

type FormState = {
  status: "idle" | "error" | "success";
  message: string;
};

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value ? String(value).trim() : "";
}

/** Admin + Hiring Chair — same audience as the unified applicant board. */
async function requireChair() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("HIRING_CHAIR")) {
    throw new Error("Unauthorized - Admin or Hiring Chair access required");
  }
  return session;
}

async function notifyChapterPresidentApplicationReviewers(applicantId: string) {
  const [applicant, reviewers] = await Promise.all([
    prisma.user.findUnique({
      where: { id: applicantId },
      select: { name: true },
    }),
    prisma.user.findMany({
      where: {
        roles: { some: { role: { in: [RoleType.ADMIN, RoleType.HIRING_CHAIR] } } },
      },
      select: { email: true },
    }),
  ]);

  const emails = reviewers.map((reviewer) => reviewer.email).filter(Boolean);
  if (emails.length === 0) {
    return;
  }

  const { getBaseUrl } = await import("@/lib/portal-auth-utils");
  const baseUrl = await getBaseUrl();
  await sendNewApplicationNotification({
    to: emails,
    applicantName: applicant?.name ?? "Unknown",
    reviewUrl: `${baseUrl}/admin/instructor-applicants?kind=cp`,
  });
}

export async function submitChapterPresidentApplication(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { status: "error", message: "Unauthorized" };

    const existing = await prisma.chapterPresidentApplication.findUnique({
      where: { applicantId: session.user.id },
    });
    if (existing) {
      return { status: "error", message: "You already have a chapter president application." };
    }

    const leadershipExperience = getString(formData, "leadershipExperience");
    const chapterVision = getString(formData, "chapterVision");
    const availability = getString(formData, "availability");
    const chapterId = getString(formData, "chapterId", false) || null;

    // Personal info
    const legalName = getString(formData, "legalName", false);
    const preferredFirstName = getString(formData, "preferredFirstName", false);
    const lastName = getString(formData, "lastName");
    if (lastName.length > 100) {
      return { status: "error", message: "Last name should be under 100 characters." };
    }
    const phoneNumber = getString(formData, "phoneNumber", false);
    const dateOfBirth = getString(formData, "dateOfBirth", false);
    const hearAboutYPPRaw = getString(formData, "hearAboutYPP", false);
    // hearAboutYPP already has the detail concatenated by the form (e.g. "A YPP staff member: Jane Doe")
    const hearAboutYPP = hearAboutYPPRaw || null;

    // Location
    const city = getString(formData, "city", false);
    const stateProvince = getString(formData, "stateProvince", false);
    const zipCode = getString(formData, "zipCode", false);
    const country = getString(formData, "country", false) || "United States";
    const countryOther = getString(formData, "countryOther", false);

    // Academic
    const schoolName = getString(formData, "schoolName", false);
    const grade = getString(formData, "grade", false);
    const graduationYearRaw = getString(formData, "graduationYear", false);
    const graduationYear = graduationYearRaw ? parseInt(graduationYearRaw, 10) : null;
    const gpa = getString(formData, "gpa", false);
    const classRank = getString(formData, "classRank", false);

    // Chapter-specific essays
    const whyChapterPresident = getString(formData, "whyChapterPresident", false);
    const partnerSchool = getString(formData, "partnerSchool", false);
    const currentYppInvolvement = getString(formData, "currentYppInvolvement", false);
    const communityServiceExperience = getString(formData, "communityServiceExperience", false);
    const potentialChapterLocation = getString(formData, "potentialChapterLocation", false);
    const firstThreeActions = getString(formData, "firstThreeActions", false);
    const recruitmentPlan = getString(formData, "recruitmentPlan", false);
    const launchPlan = getString(formData, "launchPlan", false);
    const extracurriculars = getString(formData, "extracurriculars", false);
    const priorOrganizing = getString(formData, "priorOrganizing", false);
    const specialSkills = getString(formData, "specialSkills", false);

    // Supporting document
    const documentUrl = getString(formData, "documentUrl", false);

    // Instructor information (optional)
    const instructorApplicantPosition = getString(formData, "instructorApplicantPosition", false);
    const classInMind = getString(formData, "classInMind", false);
    const instructorTeachingDesc = getString(formData, "instructorTeachingDesc", false);

    // Referral & availability
    const referralEmails = getString(formData, "referralEmails", false);
    const hoursPerWeekRaw = getString(formData, "hoursPerWeek", false);
    const hoursPerWeek = hoursPerWeekRaw ? parseInt(hoursPerWeekRaw, 10) : null;
    const preferredStartDate = getString(formData, "preferredStartDate", false);

    // Demographics
    const ethnicity = getString(formData, "ethnicity", false);
    const formTemplate = await prisma.applicationFormTemplate.findFirst({
      where: {
        roleType: "CHAPTER_PRESIDENT",
        isActive: true,
      },
      select: {
        fields: {
          select: {
            id: true,
            label: true,
            fieldType: true,
            required: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    const allowedFieldIds = new Set(formTemplate?.fields.map((field) => field.id) ?? []);

    // Get custom field responses
    const customFields: { fieldId: string; value: string; fileUrl?: string }[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("custom_field_")) {
        const fieldId = key.replace("custom_field_", "");
        if (!allowedFieldIds.has(fieldId)) continue;
        customFields.push({ fieldId, value: String(value) });
      }
      if (key.startsWith("custom_file_")) {
        const fieldId = key.replace("custom_file_", "");
        if (!allowedFieldIds.has(fieldId)) continue;
        const existing = customFields.find((f) => f.fieldId === fieldId);
        if (existing) {
          existing.fileUrl = String(value);
        } else {
          customFields.push({ fieldId, value: "", fileUrl: String(value) });
        }
      }
    }
    for (const field of formTemplate?.fields ?? []) {
      const response = customFields.find((entry) => entry.fieldId === field.id);
      const hasValue =
        field.fieldType === "FILE_UPLOAD"
          ? Boolean(response?.fileUrl?.trim())
          : Boolean(response?.value?.trim());

      if (field.required && !hasValue) {
        throw new Error(`${field.label} is required.`);
      }
    }

    let createdApplicationId = "";
    await prisma.$transaction(async (tx) => {
      const application = await tx.chapterPresidentApplication.create({
        data: {
          applicantId: session.user.id,
          chapterId,
          leadershipExperience,
          chapterVision,
          availability,
          legalName: legalName || null,
          preferredFirstName: preferredFirstName || null,
          lastName,
          phoneNumber: phoneNumber || null,
          dateOfBirth: dateOfBirth || null,
          hearAboutYPP: hearAboutYPP || null,
          city: city || null,
          stateProvince: stateProvince || null,
          zipCode: zipCode || null,
          country: country === "Other" ? (countryOther || "Other") : country,
          schoolName: schoolName || null,
          grade: grade || null,
          graduationYear: graduationYear && !isNaN(graduationYear) ? graduationYear : null,
          gpa: gpa || null,
          classRank: classRank || null,
          whyChapterPresident: whyChapterPresident || null,
          partnerSchool: partnerSchool || null,
          currentYppInvolvement: currentYppInvolvement || null,
          communityServiceExperience: communityServiceExperience || null,
          potentialChapterLocation: potentialChapterLocation || null,
          firstThreeActions: firstThreeActions || null,
          recruitmentPlan: recruitmentPlan || null,
          launchPlan: launchPlan || null,
          extracurriculars: extracurriculars || null,
          priorOrganizing: priorOrganizing || null,
          specialSkills: specialSkills || null,
          referralEmails: referralEmails || null,
          documentUrl: documentUrl || null,
          instructorApplicantPosition: instructorApplicantPosition || null,
          classInMind: classInMind || null,
          instructorTeachingDesc: instructorTeachingDesc || null,
          hoursPerWeek: hoursPerWeek && !isNaN(hoursPerWeek) ? hoursPerWeek : null,
          preferredStartDate: preferredStartDate || null,
          ethnicity: ethnicity || null,
        },
      });
      createdApplicationId = application.id;

      // Save custom form responses
      if (customFields.length > 0) {
        await tx.applicationFormResponse.createMany({
          data: customFields.map((f) => ({
            fieldId: f.fieldId,
            chapterPresidentApplicationId: application.id,
            value: f.value,
            fileUrl: f.fileUrl || null,
          })),
        });
      }
    });
    if (createdApplicationId) {
      await syncChapterPresidentApplicationWorkflow(createdApplicationId);
    }

    // Notify reviewers
    try {
      await notifyChapterPresidentApplicationReviewers(session.user.id);
    } catch (e) {
      console.error("[submitCPApplication] notify failed:", e);
    }

    revalidatePath("/application-status");
    revalidatePath("/admin/chapter-president-applicants");
    return { status: "success", message: "Your chapter president application has been submitted!" };
  } catch (error) {
    console.error("[submitCPApplication]", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function reviewChapterPresidentApplication(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const session = await requireChair();
    const action = getString(formData, "action");
    const applicationId = getString(formData, "applicationId");

    const application = await prisma.chapterPresidentApplication.findUnique({
      where: { id: applicationId },
      include: { applicant: { select: { id: true, name: true, email: true } } },
    });
    if (!application) return { status: "error", message: "Application not found." };

    const reviewAction = action as LegacyApplicationReviewAction;
    const transitionError = getLegacyApplicationTransitionError({
      status: application.status,
      action: reviewAction,
    });
    if (transitionError) {
      return { status: "error", message: transitionError };
    }

    switch (reviewAction) {
      case "mark_under_review":
        await prisma.chapterPresidentApplication.update({
          where: { id: applicationId },
          data: { status: "INITIAL_REVIEW", reviewerId: session.user.id },
        });
        await syncChapterPresidentApplicationWorkflow(applicationId);
        break;

      case "approve": {
        if (!application.chapterId) {
          return {
            status: "error",
            message: "Assign a chapter before approving this chapter president application.",
          };
        }

        const notes = getString(formData, "notes", false);
        const chapterId = application.chapterId;
        const now = new Date();

        await prisma.$transaction(async (tx) => {
          await tx.chapterPresidentApplication.update({
            where: { id: applicationId },
            data: {
              status: "ONBOARDING",
              reviewerId: session.user.id,
              reviewerNotes: notes || null,
              approvedAt: now,
              decisionMakerId: session.user.id,
              decisionAt: now,
              linkedPersonId: application.applicantId,
              roleAssignedAt: now,
              onboardingStartedAt: now,
            },
          });

          // Assign CHAPTER_PRESIDENT role
          await tx.user.update({
            where: { id: application.applicantId },
            data: {
              primaryRole: RoleType.CHAPTER_PRESIDENT,
              ...(chapterId ? { chapterId } : {}),
            },
          });
          await tx.userRole.upsert({
            where: { userId_role: { userId: application.applicantId, role: RoleType.CHAPTER_PRESIDENT } },
            update: {},
            create: { userId: application.applicantId, role: RoleType.CHAPTER_PRESIDENT },
          });

          // Create onboarding record
          if (chapterId) {
            await tx.chapterPresidentOnboarding.upsert({
              where: { userId: application.applicantId },
              update: { chapterId, status: "IN_PROGRESS" },
              create: {
                userId: application.applicantId,
                chapterId,
                status: "IN_PROGRESS",
              },
            });

            // Provision the chapter operating system: link the president, flow
            // application data into chapter setup (no re-entry), move the chapter
            // to LAUNCHING, and seed the launch checklist as real Action Tracker
            // items. The chapter becomes a managed launch, not just a record.
            const chapterRow = await tx.chapter.findUnique({
              where: { id: chapterId },
              select: {
                id: true,
                lifecycleStatus: true,
                state: true,
                city: true,
                partnerSchool: true,
                launchPlanText: true,
              },
            });
            if (chapterRow) {
              await provisionChapterForApproval(tx, {
                chapter: chapterRow,
                application: {
                  stateProvince: application.stateProvince,
                  city: application.city,
                  partnerSchool: application.partnerSchool,
                  schoolName: application.schoolName,
                  launchPlan: application.launchPlan,
                },
                presidentId: application.applicantId,
                presidentName: application.applicant.name,
                actorId: session.user.id,
                now,
              });
              await tx.chapterPresidentApplication.update({
                where: { id: applicationId },
                data: { starterActionsCreatedAt: now },
              });
            }
          }
        });

        // Best-effort: approval reaching ONBOARDING can auto-start a matching,
        // published workflow template instance (e.g. Chapter President
        // Onboarding) for this application — separate from, and complementary
        // to, the bespoke ChapterPresidentOnboarding checklist record above.
        await fireEntityStatusChanged({
          subjectType: "CHAPTER_PRESIDENT_APPLICATION",
          subjectId: applicationId,
          newStatus: "ONBOARDING",
          chapterId: application.chapterId,
          ownerId: application.applicantId,
          startedById: session.user.id,
        });

        try {
          await sendApplicationApprovedEmail({
            to: application.applicant.email,
            applicantName: application.applicant.name,
          });
        } catch (e) {
          console.error("[approveCPApplication] email failed:", e);
        }

        await syncChapterPresidentApplicationWorkflow(applicationId);
        await revalidateCPApplicantPaths(applicationId);
        return { status: "success", message: "Application accepted. Onboarding is ready." };
      }

      case "reject": {
        const reason = getString(formData, "reason");
        await prisma.chapterPresidentApplication.update({
          where: { id: applicationId },
          data: {
            status: "DECLINED",
            reviewerId: session.user.id,
            rejectionReason: reason,
            rejectedAt: new Date(),
            decisionMakerId: session.user.id,
            decisionAt: new Date(),
          },
        });
        try {
          await sendApplicationRejectedEmail({
            to: application.applicant.email,
            applicantName: application.applicant.name,
            reason,
          });
        } catch (e) {
          console.error("[rejectCPApplication] email failed:", e);
        }
        await syncChapterPresidentApplicationWorkflow(applicationId);
        break;
      }

      case "request_info": {
        const message = getString(formData, "message");
        await prisma.chapterPresidentApplication.update({
          where: { id: applicationId },
          data: {
            status: "NEEDS_MORE_INFO",
            reviewerId: session.user.id,
            infoRequest: message,
          },
        });
        const { getBaseUrl } = await import("@/lib/portal-auth-utils");
        const baseUrl = await getBaseUrl();
        try {
          await sendInfoRequestEmail({
            to: application.applicant.email,
            applicantName: application.applicant.name,
            message,
            statusUrl: `${baseUrl}/application-status`,
          });
        } catch (e) {
          console.error("[requestCPInfo] email failed:", e);
        }
        await syncChapterPresidentApplicationWorkflow(applicationId);
        break;
      }

      case "schedule_interview": {
        const dateStr = getString(formData, "scheduledAt");
        const scheduledAt = new Date(dateStr);
        if (isNaN(scheduledAt.getTime())) {
          return { status: "error", message: "Invalid interview date/time." };
        }
        const meetingUrl = getString(formData, "meetingUrl", false) || null;
        if (meetingUrl && !/^https?:\/\//i.test(meetingUrl)) {
          return { status: "error", message: "Meeting link must be a valid URL." };
        }
        const notes = getString(formData, "notes", false);
        await prisma.chapterPresidentApplication.update({
          where: { id: applicationId },
          data: {
            status: ChapterPresidentApplicationStatus.INTERVIEW_SCHEDULED,
            reviewerId: session.user.id,
            interviewScheduledAt: scheduledAt,
            interviewMeetingUrl: meetingUrl,
            reviewerNotes: notes || null,
          },
        });
        const { getBaseUrl } = await import("@/lib/portal-auth-utils");
        const baseUrl = await getBaseUrl();
        try {
          await sendInterviewScheduledEmail({
            to: application.applicant.email,
            applicantName: application.applicant.name,
            scheduledAt,
            statusUrl: `${baseUrl}/application-status`,
            meetingUrl,
          });
        } catch (e) {
          console.error("[scheduleCPInterview] email failed:", e);
        }
        await syncChapterPresidentApplicationWorkflow(applicationId);
        break;
      }

      case "mark_interview_complete": {
        const notes = getString(formData, "notes", false);
        await prisma.chapterPresidentApplication.update({
          where: { id: applicationId },
          data: {
            status: "DECISION_NEEDED",
            reviewerId: session.user.id,
            reviewerNotes: notes || null,
            interviewNotes: notes || null,
            interviewSummary: notes || null,
          },
        });
        await syncChapterPresidentApplicationWorkflow(applicationId);
        break;
      }

      case "submit_recommendation": {
        const recommendationRaw = getString(formData, "recommendation");
        const validRecommendations = Object.values(HiringRecommendation) as string[];
        if (!validRecommendations.includes(recommendationRaw)) {
          return { status: "error", message: "Pick a recommendation before submitting." };
        }
        const rationale = getString(formData, "recommendationRationale");
        await prisma.chapterPresidentApplication.update({
          where: { id: applicationId },
          data: {
            status: "DECISION_NEEDED",
            reviewerId: session.user.id,
            decisionRecommendation: recommendationRaw as HiringRecommendation,
            recommendationRationale: rationale,
          },
        });
        await syncChapterPresidentApplicationWorkflow(applicationId);
        break;
      }

      default:
        return { status: "error", message: "Unknown action." };
    }

    revalidatePath("/admin/chapter-president-applicants");
    revalidatePath("/admin/instructor-applicants");
    revalidatePath("/application-status");
    return { status: "success", message: "Action completed." };
  } catch (error) {
    console.error("[reviewCPApplication]", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function reviewCPApplicationAction(formData: FormData): Promise<void> {
  await reviewChapterPresidentApplication({ status: "idle", message: "" }, formData);
}

export async function submitCPInfoResponse(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { status: "error", message: "Unauthorized" };

    const response = getString(formData, "applicantResponse");

    const application = await prisma.chapterPresidentApplication.findUnique({
      where: { applicantId: session.user.id },
    });
    if (!application) return { status: "error", message: "Application not found." };
    if (application.applicantId !== session.user.id) {
      return { status: "error", message: "Unauthorized." };
    }
    if (
      application.status !== ChapterPresidentApplicationStatus.INFO_REQUESTED &&
      application.status !== ("NEEDS_MORE_INFO" as ChapterPresidentApplicationStatus)
    ) {
      return {
        status: "error",
        message: "Your application is not waiting on an information response right now.",
      };
    }

    await prisma.chapterPresidentApplication.update({
      where: { id: application.id },
      data: {
        applicantResponse: response,
        status: ChapterPresidentApplicationStatus.SUBMITTED,
      },
    });
    await syncChapterPresidentApplicationWorkflow(application.id);

    try {
      await notifyChapterPresidentApplicationReviewers(session.user.id);
    } catch (e) {
      console.error("[submitCPInfoResponse] notify failed:", e);
    }

    revalidatePath("/application-status");
    return { status: "success", message: "Your response has been submitted." };
  } catch (error) {
    console.error("[submitCPInfoResponse]", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

function getOptionalString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalScore(formData: FormData, key: string): number | null {
  const raw = getOptionalString(formData, key);
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 1 && value <= 5 ? value : null;
}

async function revalidateCPApplicantPaths(applicationId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/admin/chapter-president-applicants");
  revalidatePath(`/admin/chapter-president-applicants/${applicationId}`);
  revalidatePath("/application-status");
  revalidatePath("/my-interview");
  revalidatePath("/follow-up");
}

export async function beginCPInitialReviewAction(formData: FormData) {
  const session = await requireChair();
  const applicationId = getString(formData, "applicationId");

  await prisma.chapterPresidentApplication.update({
    where: { id: applicationId },
    data: {
      status: "INITIAL_REVIEW",
      reviewerId: session.user.id,
    },
  });
  await syncChapterPresidentApplicationWorkflow(applicationId);
  await revalidateCPApplicantPaths(applicationId);
}

export async function assignCPReviewerAction(formData: FormData) {
  await requireChair();
  const applicationId = getString(formData, "applicationId");
  const reviewerId = getOptionalString(formData, "reviewerId");

  await prisma.chapterPresidentApplication.update({
    where: { id: applicationId },
    data: { reviewerId: reviewerId || null },
  });
  await syncChapterPresidentApplicationWorkflow(applicationId);
  await revalidateCPApplicantPaths(applicationId);
}

export async function assignCPChapterAction(formData: FormData) {
  await requireChair();
  const applicationId = getString(formData, "applicationId");
  const chapterId = getOptionalString(formData, "chapterId");

  if (chapterId) {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true },
    });
    if (!chapter) throw new Error("Chapter not found.");
  }

  await prisma.chapterPresidentApplication.update({
    where: { id: applicationId },
    data: { chapterId: chapterId || null },
  });
  await syncChapterPresidentApplicationWorkflow(applicationId);
  await revalidateCPApplicantPaths(applicationId);
}

export async function saveCPReviewAction(formData: FormData) {
  const session = await requireChair();
  const applicationId = getString(formData, "applicationId");
  const recommendation = getOptionalString(formData, "reviewRecommendation");
  const infoRequest = getOptionalString(formData, "infoRequest");
  const reviewerNotes = getOptionalString(formData, "reviewerNotes");

  let nextStatus: ChapterPresidentApplicationStatus | undefined;
  if (recommendation === "interview") nextStatus = "INTERVIEW_NEEDED" as ChapterPresidentApplicationStatus;
  if (recommendation === "decision") nextStatus = "DECISION_NEEDED" as ChapterPresidentApplicationStatus;
  if (recommendation === "needs_more_info") nextStatus = "NEEDS_MORE_INFO" as ChapterPresidentApplicationStatus;

  const application = await prisma.chapterPresidentApplication.update({
    where: { id: applicationId },
    data: {
      reviewerId: session.user.id,
      ...(nextStatus ? { status: nextStatus } : {}),
      scoreFit: getOptionalScore(formData, "scoreFit"),
      scoreLeadership: getOptionalScore(formData, "scoreLeadership"),
      scoreCommunication: getOptionalScore(formData, "scoreCommunication"),
      scoreCommitment: getOptionalScore(formData, "scoreCommitment"),
      scoreRecruiting: getOptionalScore(formData, "scoreRecruiting"),
      scoreOrganization: getOptionalScore(formData, "scoreOrganization"),
      scoreVision: getOptionalScore(formData, "scoreVision"),
      scoreOverallConfidence: getOptionalScore(formData, "scoreOverallConfidence"),
      reviewerNotes: reviewerNotes || null,
      infoRequest: recommendation === "needs_more_info" ? infoRequest || null : undefined,
    },
    include: { applicant: { select: { email: true, name: true } } },
  });

  if (recommendation === "needs_more_info") {
    const { getBaseUrl } = await import("@/lib/portal-auth-utils");
    const baseUrl = await getBaseUrl();
    sendInfoRequestEmail({
      to: application.applicant.email,
      applicantName: application.applicant.name,
      message: infoRequest || reviewerNotes || "Please provide the requested follow-up information.",
      statusUrl: `${baseUrl}/application-status`,
    }).catch((e) => console.error("[saveCPReviewAction] info email failed:", e));
  }

  await syncChapterPresidentApplicationWorkflow(applicationId);
  await revalidateCPApplicantPaths(applicationId);
}

export async function scheduleCPInterviewAction(formData: FormData) {
  const session = await requireChair();
  const applicationId = getString(formData, "applicationId");
  const scheduledAtRaw = getString(formData, "scheduledAt");
  const scheduledAt = new Date(scheduledAtRaw);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Pick a valid interview date and time.");
  }
  const meetingUrl = getOptionalString(formData, "meetingUrl");
  if (meetingUrl && !/^https?:\/\//i.test(meetingUrl)) {
    throw new Error("Meeting link must start with http:// or https://.");
  }

  const application = await prisma.chapterPresidentApplication.update({
    where: { id: applicationId },
    data: {
      status: "INTERVIEW_SCHEDULED",
      reviewerId: session.user.id,
      interviewScheduledAt: scheduledAt,
      interviewMeetingUrl: meetingUrl || null,
      schedulingNoMatchAt: null,
    },
    include: { applicant: { select: { email: true, name: true } } },
  });

  const { getBaseUrl } = await import("@/lib/portal-auth-utils");
  const baseUrl = await getBaseUrl();
  sendInterviewScheduledEmail({
    to: application.applicant.email,
    applicantName: application.applicant.name,
    scheduledAt,
    statusUrl: `${baseUrl}/application-status`,
    meetingUrl: meetingUrl || null,
  }).catch((e) => console.error("[scheduleCPInterviewAction] email failed:", e));

  await syncChapterPresidentApplicationWorkflow(applicationId);
  await revalidateCPApplicantPaths(applicationId);
}

export async function completeCPInterviewAction(formData: FormData) {
  const session = await requireChair();
  const applicationId = getString(formData, "applicationId");
  const interviewNotes = getString(formData, "interviewNotes");
  const concerns = getOptionalString(formData, "interviewConcerns");
  const followUps = getOptionalString(formData, "interviewFollowUpQuestions");

  await prisma.chapterPresidentApplication.update({
    where: { id: applicationId },
    data: {
      status: "DECISION_NEEDED",
      reviewerId: session.user.id,
      interviewNotes,
      interviewSummary: interviewNotes,
      interviewScore: getOptionalScore(formData, "interviewScore"),
      interviewConcerns: concerns || null,
      interviewFollowUpQuestions: followUps || null,
    },
  });
  await syncChapterPresidentApplicationWorkflow(applicationId);
  await revalidateCPApplicantPaths(applicationId);
}

export async function makeCPDecisionAction(formData: FormData) {
  const session = await requireChair();
  const applicationId = getString(formData, "applicationId");
  const decision = getString(formData, "decision");
  const note = getOptionalString(formData, "finalDecisionNote");
  const infoRequest = getOptionalString(formData, "infoRequest");

  const application = await prisma.chapterPresidentApplication.findUnique({
    where: { id: applicationId },
    include: { applicant: { select: { email: true, name: true } } },
  });
  if (!application) throw new Error("Application not found.");

  if (decision === "ACCEPT") {
    await prisma.chapterPresidentApplication.update({
      where: { id: applicationId },
      data: {
        status: "ONBOARDING",
        decisionRecommendation: "YES",
        finalDecisionNote: note || null,
        decisionMakerId: session.user.id,
        decisionAt: new Date(),
        approvedAt: new Date(),
        onboardingStartedAt: new Date(),
      },
    });
  } else if (decision === "WAITLIST") {
    await prisma.chapterPresidentApplication.update({
      where: { id: applicationId },
      data: {
        status: "WAITLISTED",
        decisionRecommendation: "MAYBE",
        finalDecisionNote: note || null,
        decisionMakerId: session.user.id,
        decisionAt: new Date(),
      },
    });
  } else if (decision === "DECLINE") {
    await prisma.chapterPresidentApplication.update({
      where: { id: applicationId },
      data: {
        status: "DECLINED",
        decisionRecommendation: "NO",
        finalDecisionNote: note || null,
        rejectionReason: note || null,
        decisionMakerId: session.user.id,
        decisionAt: new Date(),
        rejectedAt: new Date(),
      },
    });
    sendApplicationRejectedEmail({
      to: application.applicant.email,
      applicantName: application.applicant.name,
      reason: note || "We are not moving forward at this time.",
    }).catch((e) => console.error("[makeCPDecisionAction] rejection email failed:", e));
  } else if (decision === "NEEDS_MORE_INFO") {
    await prisma.chapterPresidentApplication.update({
      where: { id: applicationId },
      data: {
        status: "NEEDS_MORE_INFO",
        decisionRecommendation: "MAYBE",
        finalDecisionNote: note || null,
        infoRequest: infoRequest || note || null,
        decisionMakerId: session.user.id,
        decisionAt: new Date(),
      },
    });
    const { getBaseUrl } = await import("@/lib/portal-auth-utils");
    const baseUrl = await getBaseUrl();
    sendInfoRequestEmail({
      to: application.applicant.email,
      applicantName: application.applicant.name,
      message: infoRequest || note || "Please provide the requested follow-up information.",
      statusUrl: `${baseUrl}/application-status`,
    }).catch((e) => console.error("[makeCPDecisionAction] info email failed:", e));
  } else {
    throw new Error("Pick a valid decision.");
  }

  await syncChapterPresidentApplicationWorkflow(applicationId);
  await revalidateCPApplicantPaths(applicationId);
}

export async function markCPAcceptanceEmailSentAction(formData: FormData) {
  await requireChair();
  const applicationId = getString(formData, "applicationId");
  const application = await prisma.chapterPresidentApplication.findUnique({
    where: { id: applicationId },
    include: { applicant: { select: { email: true, name: true } } },
  });
  if (!application) throw new Error("Application not found.");

  try {
    await sendApplicationApprovedEmail({
      to: application.applicant.email,
      applicantName: application.applicant.name,
    });
  } catch (e) {
    console.error("[markCPAcceptanceEmailSentAction] email failed:", e);
  }

  await prisma.chapterPresidentApplication.update({
    where: { id: applicationId },
    data: { acceptanceEmailSentAt: new Date() },
  });
  await revalidateCPApplicantPaths(applicationId);
}

export async function linkCPPersonAndRoleAction(formData: FormData) {
  const session = await requireChair();
  const applicationId = getString(formData, "applicationId");
  const mentorAdvisorId = getOptionalString(formData, "mentorAdvisorId");

  const application = await prisma.chapterPresidentApplication.findUnique({
    where: { id: applicationId },
    select: { applicantId: true, chapterId: true, applicant: { select: { chapterId: true } } },
  });
  if (!application) throw new Error("Application not found.");
  const chapterId = application.chapterId ?? application.applicant.chapterId;
  if (!chapterId) throw new Error("Assign a chapter before linking the CP profile.");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: application.applicantId },
      data: {
        primaryRole: RoleType.CHAPTER_PRESIDENT,
        title: "Chapter President",
        canonicalTitle: "Chapter President",
        internalLevel: 4,
        ladder: "INSTRUCTION",
        chapterId,
      },
    });
    await tx.userRole.upsert({
      where: {
        userId_role: {
          userId: application.applicantId,
          role: RoleType.CHAPTER_PRESIDENT,
        },
      },
      update: {},
      create: {
        userId: application.applicantId,
        role: RoleType.CHAPTER_PRESIDENT,
      },
    });
    await tx.chapterPresidentOnboarding.upsert({
      where: { userId: application.applicantId },
      update: { chapterId, status: "IN_PROGRESS" },
      create: {
        userId: application.applicantId,
        chapterId,
        status: "IN_PROGRESS",
      },
    });
    await tx.chapterPresidentApplication.update({
      where: { id: applicationId },
      data: {
        status: "ONBOARDING",
        linkedPersonId: application.applicantId,
        roleAssignedAt: new Date(),
        mentorAdvisorId: mentorAdvisorId || null,
        onboardingStartedAt: new Date(),
        reviewerId: session.user.id,
      },
    });
  });

  await syncChapterPresidentApplicationWorkflow(applicationId);
  await revalidateCPApplicantPaths(applicationId);
}

export async function createCPStarterActionsAction(formData: FormData) {
  const session = await requireChair();
  const applicationId = getString(formData, "applicationId");
  await syncChapterPresidentApplicationWorkflow(applicationId);

  const workflowItem = await prisma.workflowItem.findUnique({
    where: {
      sourceType_sourceId_kind: {
        sourceType: "ChapterPresidentApplication",
        sourceId: applicationId,
        kind: "CHAPTER_PRESIDENT_APPLICATION",
      },
    },
    include: {
      actionItems: { select: { title: true } },
    },
  });
  if (!workflowItem) throw new Error("Workflow item not found.");

  const existingTitles = new Set(workflowItem.actionItems.map((item) => item.title));
  const now = new Date();
  const missingActions = CP_STARTER_ACTIONS.filter((title) => !existingTitles.has(title));

  if (missingActions.length > 0) {
    await prisma.workflowActionItem.createMany({
      data: missingActions.map((title, index) => ({
        workflowItemId: workflowItem.id,
        title,
        details: "Chapter President launch onboarding task.",
        ownerId: workflowItem.subjectUserId,
        createdById: session.user.id,
        dueAt: new Date(now.getTime() + (index + 3) * 24 * 60 * 60 * 1000),
      })),
    });
  }

  await prisma.chapterPresidentApplication.update({
    where: { id: applicationId },
    data: {
      status: "ONBOARDING",
      starterActionsCreatedAt: new Date(),
    },
  });

  await syncChapterPresidentApplicationWorkflow(applicationId);
  await revalidateCPApplicantPaths(applicationId);
}

export async function completeCPOnboardingAction(formData: FormData) {
  const session = await requireChair();
  const applicationId = getString(formData, "applicationId");

  const application = await prisma.chapterPresidentApplication.findUnique({
    where: { id: applicationId },
    select: {
      applicantId: true,
      chapterId: true,
      linkedPersonId: true,
      roleAssignedAt: true,
      starterActionsCreatedAt: true,
      applicant: { select: { chapterId: true } },
    },
  });
  if (!application) throw new Error("Application not found.");
  if (!application.linkedPersonId || !application.roleAssignedAt) {
    throw new Error("Create the linked Chapter President profile first.");
  }
  if (!application.starterActionsCreatedAt) {
    throw new Error("Create the first chapter launch actions before completing onboarding.");
  }

  const chapterId = application.chapterId ?? application.applicant.chapterId;
  if (!chapterId) throw new Error("Assign a chapter before completing onboarding.");

  await prisma.$transaction(async (tx) => {
    await tx.chapterPresidentOnboarding.upsert({
      where: { userId: application.applicantId },
      update: {
        chapterId,
        metTeam: true,
        setChapterGoals: true,
        reviewedResources: true,
        introMessageSent: true,
        status: "COMPLETED",
        completedAt: new Date(),
      },
      create: {
        userId: application.applicantId,
        chapterId,
        metTeam: true,
        setChapterGoals: true,
        reviewedResources: true,
        introMessageSent: true,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    await tx.chapterPresidentApplication.update({
      where: { id: applicationId },
      data: {
        status: "ACTIVE_CP",
        onboardingCompletedAt: new Date(),
        activeAt: new Date(),
        reviewerId: session.user.id,
      },
    });
  });

  await syncChapterPresidentApplicationWorkflow(applicationId);
  await revalidateCPApplicantPaths(applicationId);
}

/** Soft-archive a CP application from the detail workspace. */
export async function archiveCPApplicationAction(formData: FormData) {
  const session = await requireChair();
  const applicationId = getString(formData, "applicationId");
  const { archiveApplicantSubmissionById } = await import("@/lib/instructor-application-actions");
  const { APPLICANT_ARCHIVE_REASONS } = await import("@/lib/applicant-archive");
  await archiveApplicantSubmissionById("chapter-president", applicationId, {
    actorId: session.user.id,
    reason: APPLICANT_ARCHIVE_REASONS.MANUAL,
  });
  await revalidateCPApplicantPaths(applicationId);
  const { redirect } = await import("next/navigation");
  redirect("/admin/instructor-applicants?view=archive&kind=cp");
}
