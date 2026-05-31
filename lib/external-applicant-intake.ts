"use server";

/**
 * Server actions for admin-driven external applicant intake.
 *
 * Goal:
 *   - Reuse the existing InstructorApplication / ChapterPresidentApplication
 *     pipeline so external applicants go through the same review, interview,
 *     chair-decision, and onboarding flows as portal-native applicants.
 *   - Mark the application with `source = GOOGLE_FORMS | MANUAL_ADMIN_ENTRY`
 *     so admins can see where it came from.
 *   - Stub-create a User if the applicant has no portal account yet, mirroring
 *     the pattern in `lib/csv-import-actions.ts` (passwordHash "IMPORTED",
 *     primaryRole APPLICANT).
 *   - Seed default ManualEmailTask rows so the admin sees a clear "what email
 *     to send next" surface even though the portal won't auto-send anything.
 *
 * Permission model:
 *   - ADMIN: full network-wide intake.
 *   - CHAPTER_PRESIDENT: intake scoped to their own chapter.
 *
 * No emails are auto-sent by this module — intake creates an application
 * + ManualEmailTask seeds only.
 */

import { revalidatePath } from "next/cache";
import {
  ApplicationSource,
  ApplicationTrack,
  ChapterPresidentApplicationStatus,
  InstructorApplicationStatus,
  InstructorSubtype,
  ManualEmailKind,
  RoleType,
} from "@prisma/client";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_EXTERNAL_INTAKE_EMAIL_KINDS,
  buildManualEmailTemplate,
} from "@/lib/application-source-config";
import { findDefaultInitialReviewerForChapter } from "@/lib/instructor-application-defaults";
import { syncChapterPresidentApplicationWorkflow } from "@/lib/workflow";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExternalApplicantSource = Extract<
  ApplicationSource,
  "GOOGLE_FORMS" | "MANUAL_ADMIN_ENTRY"
>;

export interface CreateExternalInstructorApplicantInput {
  /** Required — applicant's display name (or "First Last"). */
  name: string;
  /** Required — applicant's last name for admin identification. */
  lastName: string;
  /** Required — applicant's email; used to find or create a portal User. */
  email: string;
  /** Optional — phone number for offline contact. */
  phone?: string | null;
  /** Required — where this application came from. */
  source: ExternalApplicantSource;
  /** Optional — chapter assignment. Chapter Presidents are auto-scoped. */
  chapterId?: string | null;
  /** Optional — Standard or Summer Workshop track. Defaults to STANDARD. */
  applicationTrack?: ApplicationTrack | null;
  /** Optional — link to the Google Form response (when source = GOOGLE_FORMS). */
  externalResponseUrl?: string | null;
  /** Optional — raw / copied answers from Google Form (or notes for manual entry). */
  externalAnswersCopy?: string | null;
  /** Optional — when the applicant originally submitted externally. */
  externalSubmittedAt?: Date | null;
  /** Optional — admin notes about this applicant. */
  internalNotes?: string | null;
  /** Optional — pre-populate motivation / teaching experience / availability if known. */
  motivation?: string | null;
  teachingExperience?: string | null;
  availability?: string | null;
  /** Optional — assign to a specific cohort. */
  cohortId?: string | null;
  /** Optional — when set, the application is created already INTERVIEW_SCHEDULED. */
  interviewScheduledAt?: Date | null;
  /** Optional — Zoom / Google Meet join link. When supplied with a scheduled
   *  time, a confirmed OfferedInterviewSlot row is also created so the applicant
   *  sees the link on /my-interview. */
  interviewMeetingUrl?: string | null;
}

export interface CreateExternalInstructorApplicantResult {
  applicationId: string;
  applicantUserId: string;
  createdNewUser: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Loose meeting-link normalization: trims, and prepends `https://` if the
 * admin pasted a bare host like `zoom.us/j/123`. We deliberately don't
 * validate the URL further — meeting platforms vary too much for a regex
 * to be useful, and a bad link only ever lands in the applicant's view.
 */
function normalizeMeetingLink(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function requireAdminOrChapterLead() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isChapterLead = roles.includes("CHAPTER_PRESIDENT");
  if (!isAdmin && !isChapterLead) {
    throw new Error("Unauthorized - Admin or Chapter President access required");
  }
  return { session, isAdmin, isChapterLead };
}

// ─── Public actions ──────────────────────────────────────────────────────────

/**
 * Create an instructor application from an external source (Google Forms or
 * manual admin entry). Mirrors `csv-import-actions.ts:importApplicationsFromCSV`
 * for a single row, but stores the source/external metadata and seeds default
 * manual email tasks.
 *
 * Idempotent on email: if a User already exists, we reuse it rather than
 * creating a duplicate. We always create a *new* InstructorApplication row
 * (the existing re-application chain handles multiple applications per
 * applicant cleanly — see migration 20260510020006).
 */
export async function createExternalInstructorApplicant(
  input: CreateExternalInstructorApplicantInput,
): Promise<CreateExternalInstructorApplicantResult> {
  const { session, isAdmin } = await requireAdminOrChapterLead();
  const importedById = session.user.id;

  const name = (input.name ?? "").trim();
  const lastName = (input.lastName ?? "").trim();
  const email = normalizeEmail(input.email ?? "");
  if (!name) throw new Error("Applicant name is required.");
  if (!lastName) throw new Error("Applicant last name is required.");
  if (lastName.length > 100) throw new Error("Applicant last name should be under 100 characters.");
  if (!email || !email.includes("@")) throw new Error("A valid applicant email is required.");
  if (input.source !== "GOOGLE_FORMS" && input.source !== "MANUAL_ADMIN_ENTRY") {
    throw new Error("Source must be GOOGLE_FORMS or MANUAL_ADMIN_ENTRY.");
  }

  // Chapter Presidents may only intake into their own chapter. Admins may
  // intake into any chapter (or leave unscoped).
  let chapterId = input.chapterId?.trim() || null;
  if (!isAdmin) {
    const me = await prisma.user.findUnique({
      where: { id: importedById },
      select: { chapterId: true },
    });
    chapterId = me?.chapterId ?? null;
    if (!chapterId) {
      throw new Error("Chapter Presidents must have a chapter assigned before adding applicants.");
    }
  }

  const applicationTrack = input.applicationTrack ?? ApplicationTrack.STANDARD_INSTRUCTOR;
  const instructorSubtype =
    applicationTrack === ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR
      ? InstructorSubtype.SUMMER_WORKSHOP
      : InstructorSubtype.STANDARD;

  const interviewMeetingUrl = normalizeMeetingLink(input.interviewMeetingUrl);
  const interviewScheduledAt = input.interviewScheduledAt ?? null;
  if (interviewScheduledAt && Number.isNaN(interviewScheduledAt.getTime())) {
    throw new Error("Interview date/time is invalid.");
  }
  if (!interviewScheduledAt && interviewMeetingUrl) {
    throw new Error("Set an interview time before adding a meeting link.");
  }

  // 1) Find or create the applicant User. We mirror csv-import-actions for
  //    consistency: stub users get a sentinel passwordHash and the APPLICANT
  //    primary role. They can claim the account later via the existing
  //    email-claim flow (covered by Supabase auth + portal merge).
  const existingUser = await prisma.user.findUnique({ where: { email } });
  let applicantUser = existingUser;
  let createdNewUser = false;
  if (!applicantUser) {
    applicantUser = await prisma.user.create({
      data: {
        name,
        email,
        phone: input.phone?.trim() || null,
        passwordHash: "IMPORTED",
        primaryRole: RoleType.APPLICANT,
        chapterId,
      },
    });
    createdNewUser = true;
  } else if (chapterId && !applicantUser.chapterId) {
    // Light-touch: link an existing user to a chapter if they don't have one
    // yet. We never overwrite an existing chapter assignment.
    applicantUser = await prisma.user.update({
      where: { id: applicantUser.id },
      data: { chapterId },
      // Same shape as findUnique above so the rest of the function still
      // sees a full User row.
    });
  }

  // 2) Create the InstructorApplication. We reuse the same defaults
  //    (initial reviewer auto-assignment) that the portal-native flow uses
  //    so the application enters the existing review pipeline immediately.
  const defaultInitialReviewer = await findDefaultInitialReviewerForChapter(
    applicantUser.chapterId,
  );
  const externalImportedAt = new Date();
  const externalSubmittedAt = input.externalSubmittedAt ?? null;

  const application = await prisma.instructorApplication.create({
    data: {
      applicantId: applicantUser.id,
      source: input.source,
      importedById,
      externalImportedAt,
      externalSubmittedAt,
      externalResponseUrl: input.externalResponseUrl?.trim() || null,
      externalAnswersCopy: input.externalAnswersCopy?.trim() || null,
      internalNotes: input.internalNotes?.trim() || null,
      status: interviewScheduledAt
        ? InstructorApplicationStatus.INTERVIEW_SCHEDULED
        : defaultInitialReviewer
          ? InstructorApplicationStatus.UNDER_REVIEW
          : InstructorApplicationStatus.SUBMITTED,
      reviewerId: defaultInitialReviewer?.id,
      reviewerAssignedAt: defaultInitialReviewer ? externalImportedAt : null,
      interviewScheduledAt,
      // Pre-populated fields. Empty strings (rather than null) match the
      // portal-native flow's defaulting for required Text columns.
      motivation: input.motivation?.trim() || null,
      teachingExperience: input.teachingExperience?.trim() || "",
      availability: input.availability?.trim() || "",
      lastName,
      applicationTrack,
      instructorSubtype,
      cohortId: input.cohortId?.trim() || undefined,
      timeline: {
        create: [
          {
            kind: "EXTERNAL_INTAKE_RECORDED",
            actorId: importedById,
            payload: {
              source: input.source,
              externalResponseUrl: input.externalResponseUrl ?? null,
              externalSubmittedAt: externalSubmittedAt?.toISOString() ?? null,
            },
          },
          ...(defaultInitialReviewer
            ? [
                {
                  kind: "REVIEWER_ASSIGNED",
                  actorId: importedById,
                  payload: {
                    reviewerId: defaultInitialReviewer.id,
                    previousReviewerId: null,
                    defaultAssignment: true,
                    reason: "chapter_president_default",
                  },
                },
              ]
            : []),
        ],
      },
    },
    select: { id: true },
  });

  // 2b) If both an interview time and a meeting link are supplied, record the
  //     time + link as a confirmed OfferedInterviewSlot so the applicant can
  //     see the join link on /my-interview.
  if (interviewScheduledAt && interviewMeetingUrl) {
    await prisma.offeredInterviewSlot.create({
      data: {
        instructorApplicationId: application.id,
        scheduledAt: interviewScheduledAt,
        meetingUrl: interviewMeetingUrl,
        offeredByUserId: importedById,
        confirmedAt: externalImportedAt,
      },
    });
  }

  // 3) Seed the default manual-email checklist. Portal-native intake gets
  //    auto-emails; external intake gets a "send manually + mark sent"
  //    surface instead, so this is the first thing the admin sees.
  await seedDefaultManualEmailTasksForInstructorApplication({
    applicationId: application.id,
    applicantName: applicantUser.name,
    applicationTrack,
    createdById: importedById,
  });

  // 4) Cache invalidation so the admin board reflects the new applicant.
  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/admin/applications");
  revalidatePath("/admin/external-applicants");
  revalidatePath(`/applications/instructor/${application.id}`);

  return {
    applicationId: application.id,
    applicantUserId: applicantUser.id,
    createdNewUser,
  };
}

/**
 * Seeds the default checklist of ManualEmailTask rows for a freshly created
 * external instructor application. Idempotent: if a task of the same kind
 * already exists for this application, it is skipped.
 *
 * Exported so other intake paths (e.g. an admin-side reseed button) can reuse it.
 */
export async function seedDefaultManualEmailTasksForInstructorApplication(opts: {
  applicationId: string;
  applicantName: string | null;
  applicationTrack: ApplicationTrack;
  createdById: string | null;
}): Promise<{ created: number; skipped: number }> {
  const applicationLabel =
    opts.applicationTrack === ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR
      ? "Summer Workshop Instructor"
      : "Instructor";

  let created = 0;
  let skipped = 0;
  for (const kind of DEFAULT_EXTERNAL_INTAKE_EMAIL_KINDS) {
    const existing = await prisma.manualEmailTask.findFirst({
      where: { instructorApplicationId: opts.applicationId, kind },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    const template = buildManualEmailTemplate(kind, {
      applicantName: opts.applicantName,
      applicationLabel,
    });
    await prisma.manualEmailTask.create({
      data: {
        instructorApplicationId: opts.applicationId,
        kind,
        suggestedSubject: template.subject,
        suggestedBody: template.body,
        createdById: opts.createdById,
      },
    });
    created++;
  }
  return { created, skipped };
}

// ─── Form-data wrapper ───────────────────────────────────────────────────────

/**
 * FormData adapter so the admin-only "Add External Applicant" page can call
 * this as a `<form action={...}>` server action without manual JSON shaping.
 */
export async function createExternalInstructorApplicantFromForm(
  formData: FormData,
): Promise<{ ok: true; applicationId: string } | { ok: false; error: string }> {
  try {
    const sourceRaw = String(formData.get("source") ?? "").trim();
    const source: ExternalApplicantSource =
      sourceRaw === "MANUAL_ADMIN_ENTRY" ? "MANUAL_ADMIN_ENTRY" : "GOOGLE_FORMS";

    const trackRaw = String(formData.get("applicationTrack") ?? "").trim();
    const applicationTrack: ApplicationTrack | null =
      trackRaw === "SUMMER_WORKSHOP_INSTRUCTOR"
        ? ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR
        : trackRaw === "STANDARD_INSTRUCTOR"
          ? ApplicationTrack.STANDARD_INSTRUCTOR
          : null;

    const submittedAtRaw = String(formData.get("externalSubmittedAt") ?? "").trim();
    const externalSubmittedAt = submittedAtRaw ? new Date(submittedAtRaw) : null;
    const submittedAtValid =
      !externalSubmittedAt || !Number.isNaN(externalSubmittedAt.getTime());
    if (!submittedAtValid) {
      return { ok: false, error: "External submitted-at must be a valid date." };
    }

    const interviewRaw = String(formData.get("interviewScheduledAt") ?? "").trim();
    const interviewScheduledAt = interviewRaw ? new Date(interviewRaw) : null;
    if (interviewScheduledAt && Number.isNaN(interviewScheduledAt.getTime())) {
      return { ok: false, error: "Interview date/time must be a valid date." };
    }

    const result = await createExternalInstructorApplicant({
      name: String(formData.get("name") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? "") || null,
      source,
      chapterId: String(formData.get("chapterId") ?? "") || null,
      applicationTrack,
      externalResponseUrl: String(formData.get("externalResponseUrl") ?? "") || null,
      externalAnswersCopy: String(formData.get("externalAnswersCopy") ?? "") || null,
      externalSubmittedAt,
      internalNotes: String(formData.get("internalNotes") ?? "") || null,
      motivation: String(formData.get("motivation") ?? "") || null,
      teachingExperience: String(formData.get("teachingExperience") ?? "") || null,
      availability: String(formData.get("availability") ?? "") || null,
      cohortId: String(formData.get("cohortId") ?? "") || null,
      interviewScheduledAt,
      interviewMeetingUrl: String(formData.get("interviewMeetingUrl") ?? "") || null,
    });
    return { ok: true, applicationId: result.applicationId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}

// ─── Chapter President external intake ───────────────────────────────────────

export interface CreateExternalChapterPresidentApplicantInput {
  /** Required — applicant's display name (or "First Last"). */
  name: string;
  /** Required — applicant's last name for admin identification. */
  lastName: string;
  /** Required — applicant's email; used to find or create a portal User. */
  email: string;
  /** Optional — phone number for offline contact. */
  phone?: string | null;
  /** Required — where this application came from. */
  source: ExternalApplicantSource;
  /** Optional — chapter the applicant would lead. */
  chapterId?: string | null;
  /** Optional — link to the Google Form response (when source = GOOGLE_FORMS). */
  externalResponseUrl?: string | null;
  /** Optional — raw / copied answers from Google Form (or notes for manual entry). */
  externalAnswersCopy?: string | null;
  /** Optional — when the applicant originally submitted externally. */
  externalSubmittedAt?: Date | null;
  /** Optional — admin notes about this applicant. */
  internalNotes?: string | null;
  /** Optional — pre-populate core essays / availability if known. */
  leadershipExperience?: string | null;
  chapterVision?: string | null;
  availability?: string | null;
  /** Optional — when set, the application is created already INTERVIEW_SCHEDULED. */
  interviewScheduledAt?: Date | null;
  /** Optional — Zoom / Google Meet join link for the interview. */
  interviewMeetingUrl?: string | null;
}

export interface CreateExternalChapterPresidentApplicantResult {
  applicationId: string;
  applicantUserId: string;
  createdNewUser: boolean;
}

/**
 * Seeds the default checklist of ManualEmailTask rows for a freshly created
 * external chapter president application. Idempotent on (application, kind).
 */
export async function seedDefaultManualEmailTasksForChapterPresidentApplication(opts: {
  applicationId: string;
  applicantName: string | null;
  createdById: string | null;
}): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const kind of DEFAULT_EXTERNAL_INTAKE_EMAIL_KINDS) {
    const existing = await prisma.manualEmailTask.findFirst({
      where: { chapterPresidentApplicationId: opts.applicationId, kind },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    const template = buildManualEmailTemplate(kind, {
      applicantName: opts.applicantName,
      applicationLabel: "Chapter President",
    });
    await prisma.manualEmailTask.create({
      data: {
        chapterPresidentApplicationId: opts.applicationId,
        kind,
        suggestedSubject: template.subject,
        suggestedBody: template.body,
        createdById: opts.createdById,
      },
    });
    created++;
  }
  return { created, skipped };
}

/**
 * Create a chapter president application from an external source (Google Forms
 * or manual admin entry). Mirrors `createExternalInstructorApplicant` but for
 * the ChapterPresidentApplication pipeline.
 *
 * `ChapterPresidentApplication.applicantId` is unique — one CP application per
 * user — so this errors out if the applicant already has one on file.
 *
 * No emails are auto-sent: intake seeds ManualEmailTask rows only. When an
 * interview time is supplied the application is created already
 * INTERVIEW_SCHEDULED so it lands in the correct kanban column.
 */
export async function createExternalChapterPresidentApplicant(
  input: CreateExternalChapterPresidentApplicantInput,
): Promise<CreateExternalChapterPresidentApplicantResult> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin access required");
  }
  const importedById = session.user.id;

  const name = (input.name ?? "").trim();
  const lastName = (input.lastName ?? "").trim();
  const email = normalizeEmail(input.email ?? "");
  if (!name) throw new Error("Applicant name is required.");
  if (!lastName) throw new Error("Applicant last name is required.");
  if (lastName.length > 100) throw new Error("Applicant last name should be under 100 characters.");
  if (!email || !email.includes("@")) throw new Error("A valid applicant email is required.");
  if (input.source !== "GOOGLE_FORMS" && input.source !== "MANUAL_ADMIN_ENTRY") {
    throw new Error("Source must be GOOGLE_FORMS or MANUAL_ADMIN_ENTRY.");
  }

  const chapterId = input.chapterId?.trim() || null;
  const interviewMeetingUrl = normalizeMeetingLink(input.interviewMeetingUrl);
  const interviewScheduledAt = input.interviewScheduledAt ?? null;
  if (interviewScheduledAt && Number.isNaN(interviewScheduledAt.getTime())) {
    throw new Error("Interview date/time is invalid.");
  }

  // 1) Find or create the applicant User (mirrors the instructor intake).
  const existingUser = await prisma.user.findUnique({ where: { email } });
  let applicantUser = existingUser;
  let createdNewUser = false;
  if (!applicantUser) {
    applicantUser = await prisma.user.create({
      data: {
        name,
        email,
        phone: input.phone?.trim() || null,
        passwordHash: "IMPORTED",
        primaryRole: RoleType.APPLICANT,
        chapterId,
      },
    });
    createdNewUser = true;
  } else if (chapterId && !applicantUser.chapterId) {
    applicantUser = await prisma.user.update({
      where: { id: applicantUser.id },
      data: { chapterId },
    });
  }

  // 2) Guard against duplicate CP applications (applicantId is unique).
  const existingApplication = await prisma.chapterPresidentApplication.findUnique({
    where: { applicantId: applicantUser.id },
    select: { id: true },
  });
  if (existingApplication) {
    throw new Error("This applicant already has a chapter president application on file.");
  }

  // 3) Create the ChapterPresidentApplication.
  const externalImportedAt = new Date();
  const application = await prisma.chapterPresidentApplication.create({
    data: {
      applicantId: applicantUser.id,
      chapterId,
      status: interviewScheduledAt
        ? ChapterPresidentApplicationStatus.INTERVIEW_SCHEDULED
        : ChapterPresidentApplicationStatus.SUBMITTED,
      interviewScheduledAt,
      interviewMeetingUrl,
      // Required Text columns — default to empty strings, same as the
      // portal-native flow's defaulting for unsupplied required fields.
      leadershipExperience: input.leadershipExperience?.trim() || "",
      chapterVision: input.chapterVision?.trim() || "",
      availability: input.availability?.trim() || "",
      lastName,
      phoneNumber: input.phone?.trim() || null,
      source: input.source,
      importedById,
      externalImportedAt,
      externalSubmittedAt: input.externalSubmittedAt ?? null,
      externalResponseUrl: input.externalResponseUrl?.trim() || null,
      externalAnswersCopy: input.externalAnswersCopy?.trim() || null,
      internalNotes: input.internalNotes?.trim() || null,
    },
    select: { id: true },
  });

  // 4) Seed the manual-email checklist + sync workflow state.
  await seedDefaultManualEmailTasksForChapterPresidentApplication({
    applicationId: application.id,
    applicantName: applicantUser.name,
    createdById: importedById,
  });
  await syncChapterPresidentApplicationWorkflow(application.id);

  // 5) Cache invalidation.
  revalidatePath("/admin/chapter-president-applicants");
  revalidatePath("/admin/external-applicants");

  return {
    applicationId: application.id,
    applicantUserId: applicantUser.id,
    createdNewUser,
  };
}

/**
 * FormData adapter for the admin "Add External Applicant" page when the
 * Chapter President role is selected.
 */
export async function createExternalChapterPresidentApplicantFromForm(
  formData: FormData,
): Promise<{ ok: true; applicationId: string } | { ok: false; error: string }> {
  try {
    const sourceRaw = String(formData.get("source") ?? "").trim();
    const source: ExternalApplicantSource =
      sourceRaw === "MANUAL_ADMIN_ENTRY" ? "MANUAL_ADMIN_ENTRY" : "GOOGLE_FORMS";

    const submittedAtRaw = String(formData.get("externalSubmittedAt") ?? "").trim();
    const externalSubmittedAt = submittedAtRaw ? new Date(submittedAtRaw) : null;
    if (externalSubmittedAt && Number.isNaN(externalSubmittedAt.getTime())) {
      return { ok: false, error: "External submitted-at must be a valid date." };
    }

    const interviewRaw = String(formData.get("interviewScheduledAt") ?? "").trim();
    const interviewScheduledAt = interviewRaw ? new Date(interviewRaw) : null;
    if (interviewScheduledAt && Number.isNaN(interviewScheduledAt.getTime())) {
      return { ok: false, error: "Interview date/time must be a valid date." };
    }

    const result = await createExternalChapterPresidentApplicant({
      name: String(formData.get("name") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? "") || null,
      source,
      chapterId: String(formData.get("chapterId") ?? "") || null,
      externalResponseUrl: String(formData.get("externalResponseUrl") ?? "") || null,
      externalAnswersCopy: String(formData.get("externalAnswersCopy") ?? "") || null,
      externalSubmittedAt,
      internalNotes: String(formData.get("internalNotes") ?? "") || null,
      leadershipExperience: String(formData.get("leadershipExperience") ?? "") || null,
      chapterVision: String(formData.get("chapterVision") ?? "") || null,
      availability: String(formData.get("availability") ?? "") || null,
      interviewScheduledAt,
      interviewMeetingUrl: String(formData.get("interviewMeetingUrl") ?? "") || null,
    });
    return { ok: true, applicationId: result.applicationId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}
