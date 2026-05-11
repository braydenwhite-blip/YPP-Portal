"use server";

import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/server";
import {
  InstructorApplicationStatus,
  RoleType,
  ApplicationTrack,
  InstructorSubtype,
  ApplicationSource,
} from "@prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { syncInstructorApplicationWorkflow } from "@/lib/workflow";
import { findDefaultInitialReviewerForChapter } from "@/lib/instructor-application-defaults";
import {
  instructorApplicationSchema,
  summerWorkshopInstructorApplicationSchema,
  type InstructorApplicationInput,
  type SummerWorkshopInstructorApplicationInput,
} from "@/lib/application-schemas";
import { pickFormFields, type SignupFormState } from "@/lib/signup-form-utils";
import { SUMMER_WORKSHOP_TIMELINE_KINDS } from "@/lib/summer-workshop";
import { isRegularInstructorEnabled } from "@/lib/feature-flags";

type FormState = SignupFormState;

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

async function upsertPortalUser(params: {
  name: string;
  email: string;
  phone?: string;
  primaryRole: RoleType;
  chapterId?: string;
  supabaseAuthId: string;
}) {
  const user = await prisma.user.upsert({
    where: { email: params.email },
    update: {
      name: params.name,
      phone: params.phone || null,
      passwordHash: "",
      primaryRole: params.primaryRole,
      chapterId: params.chapterId || null,
      emailVerified: new Date(),
      supabaseAuthId: params.supabaseAuthId,
    },
    create: {
      name: params.name,
      email: params.email,
      phone: params.phone || null,
      passwordHash: "",
      primaryRole: params.primaryRole,
      chapterId: params.chapterId || null,
      emailVerified: new Date(),
      supabaseAuthId: params.supabaseAuthId,
      roles: {
        create: [{ role: params.primaryRole }],
      },
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_role: {
        userId: user.id,
        role: params.primaryRole,
      },
    },
    update: {},
    create: {
      userId: user.id,
      role: params.primaryRole,
    },
  });

  return user;
}

export async function signUp(prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    const name = getString(formData, "name");
    const email = getString(formData, "email").toLowerCase();
    const password = getString(formData, "password");
    const phone = getString(formData, "phone", false);
    const chapterId = getString(formData, "chapterId", false);
    const accountTypeRaw = getString(formData, "accountType", false).toUpperCase();
    const primaryRole =
      accountTypeRaw === RoleType.APPLICANT
        ? RoleType.APPLICANT
        : accountTypeRaw === RoleType.INSTRUCTOR
        ? RoleType.INSTRUCTOR
        : RoleType.STUDENT;

    // Per-email rate limit: 5 attempts per email per 15 minutes. Prevents
    // someone from hammering signups against a specific email.
    const rl = checkRateLimit(`signup:email:${email}`, 5, 15 * 60 * 1000);
    if (!rl.success) {
      return { status: "error", message: "Too many attempts. Please try again later.", fields: pickFormFields(formData) };
    }
    // Per-IP rate limit: 10 distinct-email signups per IP per hour. Without
    // this, an attacker rotating emails could spam unlimited account
    // creation, each of which fires reviewer notification emails and creates
    // an InstructorApplication row.
    try {
      const { headers } = await import("next/headers");
      const h = await headers();
      const ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        "unknown";
      const ipRl = checkRateLimit(`signup:ip:${ip}`, 10, 60 * 60 * 1000);
      if (!ipRl.success) {
        return {
          status: "error",
          message: "Too many signup attempts from this network. Please try again later.",
          fields: pickFormFields(formData),
        };
      }
    } catch {
      // If headers() is unavailable (non-RSC context, edge cases), fall
      // through — per-email rate limit is still in effect.
    }

    // M1: Stronger password policy (8+ chars, at least one number and one letter)
    if (password.length < 8) {
      return { status: "error", message: "Password must be at least 8 characters.", fields: pickFormFields(formData) };
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return { status: "error", message: "Password must contain at least one letter and one number.", fields: pickFormFields(formData) };
    }

    let instructorApplicationInput:
      | InstructorApplicationInput
      | SummerWorkshopInstructorApplicationInput
      | null = null;

    // Track selection: applicants choose either standard or summer workshop.
    // Default to standard for any unrecognized value, preserving legacy behavior.
    const applicationTrackRaw = getString(formData, "applicationTrack", false).toUpperCase();
    let applicationTrack: ApplicationTrack =
      applicationTrackRaw === "SUMMER_WORKSHOP_INSTRUCTOR"
        ? ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR
        : ApplicationTrack.STANDARD_INSTRUCTOR;

    // Temporary gate: while the regular Instructor program is paused, all
    // new applications are routed to the Summer Workshop track regardless
    // of any (cached or crafted) form value. Reversible via env flag.
    if (!isRegularInstructorEnabled()) {
      applicationTrack = ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR;
    }
    const isSummerWorkshop = applicationTrack === ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR;

    if (primaryRole === RoleType.APPLICANT) {
      const graduationYearRaw = getString(formData, "graduationYear", false);
      const hoursPerWeekRaw = getString(formData, "hoursPerWeek", false);

      // Workshop outline payload (only used by summer workshop track).
      // Inputs come from the form as flat scalars + comma-separated lists; we
      // shape them here into the structure validated by `workshopOutlineSchema`.
      const durationMinutesRaw = getString(formData, "workshopDurationMinutes", false);
      const learningGoalsRaw = getString(formData, "workshopLearningGoals", false);
      const materialsRaw = getString(formData, "workshopMaterialsNeeded", false);
      const workshopOutlinePayload = isSummerWorkshop
        ? {
            title: getString(formData, "workshopTitle", false),
            ageRange: getString(formData, "workshopAgeRange", false),
            durationMinutes: durationMinutesRaw ? parseInt(durationMinutesRaw, 10) : undefined,
            learningGoals: learningGoalsRaw
              ? learningGoalsRaw
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
            activityFlow: getString(formData, "workshopActivityFlow", false),
            materialsNeeded: materialsRaw
              ? materialsRaw
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
            engagementHook: getString(formData, "workshopEngagementHook", false),
            adaptationNotes: getString(formData, "workshopAdaptationNotes", false),
          }
        : undefined;

      const sharedPayload = {
        legalName: getString(formData, "legalName", false),
        preferredFirstName: getString(formData, "preferredFirstName", false),
        phoneNumber: getString(formData, "phoneNumber", false),
        dateOfBirth: getString(formData, "dateOfBirth", false),
        hearAboutYPP: getString(formData, "hearAboutYPP", false),
        city: getString(formData, "city", false),
        stateProvince: getString(formData, "stateProvince", false),
        zipCode: getString(formData, "zipCode", false),
        country: getString(formData, "country", false) || "United States",
        countryOther: getString(formData, "countryOther", false),
        schoolName: getString(formData, "schoolName", false),
        graduationYear: graduationYearRaw ? parseInt(graduationYearRaw, 10) : undefined,
        subjectsOfInterest: getString(formData, "subjectsOfInterest", false),
        motivation: getString(formData, "motivation", false),
        motivationVideoUrl: getString(formData, "motivationVideoUrl", false),
        teachingExperience: getString(formData, "teachingExperience", false),
        referralEmails: getString(formData, "referralEmails", false),
        courseIdea: getString(formData, "courseIdea", false) || getString(formData, "textbook", false),
        textbook: getString(formData, "textbook", false),
        courseOutline: getString(formData, "courseOutline", false),
        firstClassPlan: getString(formData, "firstClassPlan", false),
        availability: getString(formData, "availability", false),
        hoursPerWeek: hoursPerWeekRaw ? parseInt(hoursPerWeekRaw, 10) : undefined,
        preferredStartDate: getString(formData, "preferredStartDate", false),
      };
      const validation = isSummerWorkshop
        ? summerWorkshopInstructorApplicationSchema.safeParse({
            ...sharedPayload,
            workshopOutline: workshopOutlinePayload,
          })
        : instructorApplicationSchema.safeParse(sharedPayload);

      if (!validation.success) {
        return {
          status: "error",
          message: validation.error.issues[0]?.message || "Please review your application and try again.",
          fields: pickFormFields(formData),
        };
      }

      // When the applicant picks "Other" we require a non-empty
      // `countryOther` — otherwise the row would store the literal string
      // "Other" as the country.
      if (validation.data.country === "Other" && !validation.data.countryOther?.trim()) {
        return {
          status: "error",
          message: "Please specify your country.",
          fields: pickFormFields(formData),
        };
      }

      instructorApplicationInput = validation.data;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // M2: We previously returned a generic "if this email is not already
      // registered…" success message here, which silently swallowed the
      // applicant's typed application — they saw "success" but no row was
      // created, no email arrived, and no auto-login fired.
      //
      // For applicants we surface a dedicated state so the client can render
      // a clear "you already have an account, sign in to continue" UI with
      // a magic-link option. Their typed answers stay in the local draft so
      // the form repopulates after they sign in. We continue to avoid
      // confirming/denying the password.
      //
      // Account-enumeration mitigation: differentiating "exists" from
      // "doesn't exist" is an enumeration signal. Combined with the per-IP
      // signup rate limit above (10/hour) and a tighter per-IP limit on
      // ACCOUNT_EXISTS responses specifically, the attacker can only probe
      // a small number of emails per hour. Beyond that we fall back to the
      // generic response so probing doesn't yield reliable signal.
      if (primaryRole === RoleType.APPLICANT) {
        try {
          const { headers } = await import("next/headers");
          const h = await headers();
          const ip =
            h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            h.get("x-real-ip") ||
            "unknown";
          const enumRl = checkRateLimit(
            `signup:exists-probe:ip:${ip}`,
            3,
            60 * 60 * 1000
          );
          if (!enumRl.success) {
            // Probe budget exceeded — return the generic non-distinguishing
            // response. Legitimate users hitting this are rare (they'd need
            // to try 3+ different already-registered emails in an hour).
            return {
              status: "success",
              message:
                "If this email is not already registered, your account has been created. Please check your email or try signing in.",
            };
          }
        } catch {
          /* headers() unavailable — fall through */
        }
        return {
          status: "error",
          message: "ACCOUNT_EXISTS_SIGNIN_REQUIRED",
          fields: pickFormFields(formData),
        };
      }
      return {
        status: "success",
        message:
          "If this email is not already registered, your account has been created. Please check your email or try signing in.",
      };
    }

    // Create user in Supabase Auth
    const supabaseAdmin = createServiceClient();
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        primaryRole,
        chapterId: chapterId || null,
      },
    });

    if (authError || !authData.user?.id) {
      console.error("[Signup] Supabase user creation failed:", authError ?? "createUser returned no user ID");
      return { status: "error", message: "Something went wrong creating your account. Please try again." };
    }

    let newUser: Awaited<ReturnType<typeof upsertPortalUser>> | null = null;
    try {
      newUser = await upsertPortalUser({
        name,
        email,
        phone,
        primaryRole,
        chapterId,
        supabaseAuthId: authData.user.id,
      });
    } catch (portalErr) {
      console.error("[Signup] Portal user upsert failed — rolling back Supabase user", portalErr);
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      } catch (rollbackErr) {
        console.error("[Signup] Supabase rollback also failed:", rollbackErr);
      }
      return { status: "error", message: "Something went wrong creating your account. Please try again." };
    }

    // If applicant, create the InstructorApplication record with all fields
    if (primaryRole === RoleType.APPLICANT && instructorApplicationInput) {
      const defaultInitialReviewer = await findDefaultInitialReviewerForChapter(chapterId || null);
      const defaultReviewerAssignedAt = defaultInitialReviewer ? new Date() : null;
      let application: { id: string };
      try {
        application = await prisma.instructorApplication.create({
        data: {
          applicantId: newUser.id,
          // Portal-native intake: explicitly mark the source so admin views
          // can distinguish these from Google Forms / CSV / manual entries.
          source: ApplicationSource.PORTAL,
          status: defaultInitialReviewer
            ? InstructorApplicationStatus.UNDER_REVIEW
            : InstructorApplicationStatus.SUBMITTED,
          reviewerId: defaultInitialReviewer?.id,
          reviewerAssignedAt: defaultReviewerAssignedAt,
          motivation: instructorApplicationInput.motivation || null,
          motivationVideoUrl: instructorApplicationInput.motivationVideoUrl || null,
          teachingExperience: instructorApplicationInput.teachingExperience,
          availability: instructorApplicationInput.availability,
          legalName: instructorApplicationInput.legalName,
          preferredFirstName: instructorApplicationInput.preferredFirstName,
          phoneNumber: instructorApplicationInput.phoneNumber || null,
          dateOfBirth: instructorApplicationInput.dateOfBirth || null,
          hearAboutYPP: instructorApplicationInput.hearAboutYPP || null,
          city: instructorApplicationInput.city,
          stateProvince: instructorApplicationInput.stateProvince,
          zipCode: instructorApplicationInput.zipCode,
          country:
            instructorApplicationInput.country === "Other"
              ? instructorApplicationInput.countryOther || "Other"
              : instructorApplicationInput.country,
          schoolName: instructorApplicationInput.schoolName,
          graduationYear: instructorApplicationInput.graduationYear,
          subjectsOfInterest: instructorApplicationInput.subjectsOfInterest || null,
          referralEmails: instructorApplicationInput.referralEmails || null,
          courseIdea: instructorApplicationInput.courseIdea,
          textbook: instructorApplicationInput.textbook || instructorApplicationInput.courseIdea || null,
          courseOutline: instructorApplicationInput.courseOutline || null,
          firstClassPlan: instructorApplicationInput.firstClassPlan || null,
          hoursPerWeek: instructorApplicationInput.hoursPerWeek,
          preferredStartDate: instructorApplicationInput.preferredStartDate || null,
          applicationTrack,
          instructorSubtype: isSummerWorkshop
            ? InstructorSubtype.SUMMER_WORKSHOP
            : InstructorSubtype.STANDARD,
          workshopOutline:
            isSummerWorkshop && "workshopOutline" in instructorApplicationInput
              ? (instructorApplicationInput.workshopOutline as object)
              : undefined,
          timeline: {
            create: [
              ...(defaultInitialReviewer
                ? [
                    {
                      kind: "REVIEWER_ASSIGNED",
                      actorId: null,
                      payload: {
                        reviewerId: defaultInitialReviewer.id,
                        previousReviewerId: null,
                        defaultAssignment: true,
                        reason: "chapter_president_default",
                      },
                    },
                  ]
                : []),
              {
                kind: SUMMER_WORKSHOP_TIMELINE_KINDS.TRACK_SELECTED,
                actorId: null,
                payload: { applicationTrack },
              },
              ...(isSummerWorkshop
                ? [
                    {
                      kind: SUMMER_WORKSHOP_TIMELINE_KINDS.WORKSHOP_OUTLINE_SUBMITTED,
                      actorId: null,
                      payload: { source: "application_submission" },
                    },
                  ]
                : []),
            ],
          },
        },
        select: { id: true },
      });
      } catch (appErr) {
        // Couldn't write the application row. Roll back the just-created
        // Supabase auth user + portal User so the applicant can retry from
        // a clean state instead of being stuck in the "existing user"
        // branch on their next attempt.
        console.error("[Signup] Application create failed — rolling back account", appErr);
        try {
          await prisma.user.delete({ where: { id: newUser.id } });
        } catch (e) {
          console.error("[Signup] Portal user rollback failed:", e);
        }
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        } catch (e) {
          console.error("[Signup] Supabase rollback failed:", e);
        }
        return {
          status: "error",
          message: "We couldn't save your application. Please try again — your answers are kept on this device.",
          fields: pickFormFields(formData),
        };
      }
      await syncInstructorApplicationWorkflow(application.id);
    }

    // Notify reviewers + send welcome email to applicant (both non-blocking)
    if (primaryRole === RoleType.APPLICANT) {
      try {
        const { notifyReviewersOfNewApplication } = await import("@/lib/instructor-application-actions");
        await notifyReviewersOfNewApplication(newUser.id);
      } catch (notifyError) {
        console.error("[Signup] Failed to notify reviewers:", notifyError);
      }
      try {
        const { sendInstructorApplicationSubmittedEmail } = await import("@/lib/email");
        const { toAbsoluteAppUrl } = await import("@/lib/public-app-url");
        await sendInstructorApplicationSubmittedEmail({
          to: email,
          applicantName: name,
          statusUrl: toAbsoluteAppUrl("/application-status"),
        });
      } catch (emailError) {
        console.error("[Signup] Failed to send applicant confirmation email:", emailError);
      }
      return {
        status: "success",
        message: "APPLICATION_SUBMITTED",
      };
    }

    return {
      status: "success",
      message: "ACCOUNT_CREATED"
    };
  } catch (error) {
    console.error("[Signup] Unexpected signup error:", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again."
    };
  }
}

/**
 * Submit a new instructor application for a user who's already signed in.
 * Used for the re-application flow: a user with a prior closed application
 * (REJECTED/WITHDRAWN/APPROVED) lands at /applications/instructor/new and
 * fills out the same form, but skips account creation.
 *
 * The new application is chained to the most recent prior closed
 * application via `previousApplicationId` and flagged with
 * `isReapplication = true` so reviewers see context.
 */
export async function submitInstructorApplicationForExistingUser(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const { getSession } = await import("@/lib/auth-supabase");
    const session = await getSession();
    if (!session?.user?.id) {
      return { status: "error", message: "You need to be signed in to apply." };
    }

    // Per-user rate limit. Without this, a signed-in user can spam re-apply
    // via the withdraw → re-apply loop. Each re-app sends notifications to
    // reviewers + an applicant-confirmation email — an email-amplification
    // vector against the org. 3 re-apply submissions per day is generous
    // for legitimate retries while bounding abuse.
    const reapplyRl = checkRateLimit(
      `reapply:user:${session.user.id}`,
      3,
      24 * 60 * 60 * 1000
    );
    if (!reapplyRl.success) {
      return {
        status: "error",
        message:
          "You've submitted several applications recently. Please wait a day before submitting again.",
      };
    }

    const userRow = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, chapterId: true },
    });
    if (!userRow) {
      return { status: "error", message: "User not found." };
    }

    // Block if there's already an open application — re-apply is only for
    // users whose previous application is fully closed.
    const openApp = await prisma.instructorApplication.findFirst({
      where: {
        applicantId: userRow.id,
        status: { notIn: ["APPROVED", "REJECTED", "WITHDRAWN"] },
      },
      select: { id: true },
    });
    if (openApp) {
      return {
        status: "error",
        message: "You already have an open application. Withdraw it first if you want to re-apply.",
      };
    }

    // Track gating mirrors signUp().
    const applicationTrackRaw = getString(formData, "applicationTrack", false).toUpperCase();
    let applicationTrack: ApplicationTrack =
      applicationTrackRaw === "SUMMER_WORKSHOP_INSTRUCTOR"
        ? ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR
        : ApplicationTrack.STANDARD_INSTRUCTOR;
    if (!isRegularInstructorEnabled()) {
      applicationTrack = ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR;
    }
    const isSummerWorkshop = applicationTrack === ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR;

    // Build the same payload signUp() uses, then validate.
    const graduationYearRaw = getString(formData, "graduationYear", false);
    const hoursPerWeekRaw = getString(formData, "hoursPerWeek", false);
    const durationMinutesRaw = getString(formData, "workshopDurationMinutes", false);
    const learningGoalsRaw = getString(formData, "workshopLearningGoals", false);
    const materialsRaw = getString(formData, "workshopMaterialsNeeded", false);
    const workshopOutlinePayload = isSummerWorkshop
      ? {
          title: getString(formData, "workshopTitle", false),
          ageRange: getString(formData, "workshopAgeRange", false),
          durationMinutes: durationMinutesRaw ? parseInt(durationMinutesRaw, 10) : undefined,
          learningGoals: learningGoalsRaw
            ? learningGoalsRaw.split("\n").map((s) => s.trim()).filter(Boolean)
            : [],
          activityFlow: getString(formData, "workshopActivityFlow", false),
          materialsNeeded: materialsRaw
            ? materialsRaw.split("\n").map((s) => s.trim()).filter(Boolean)
            : [],
          engagementHook: getString(formData, "workshopEngagementHook", false),
          adaptationNotes: getString(formData, "workshopAdaptationNotes", false),
        }
      : undefined;

    const sharedPayload = {
      legalName: getString(formData, "legalName", false),
      preferredFirstName: getString(formData, "preferredFirstName", false),
      phoneNumber: getString(formData, "phoneNumber", false),
      dateOfBirth: getString(formData, "dateOfBirth", false),
      hearAboutYPP: getString(formData, "hearAboutYPP", false),
      city: getString(formData, "city", false),
      stateProvince: getString(formData, "stateProvince", false),
      zipCode: getString(formData, "zipCode", false),
      country: getString(formData, "country", false) || "United States",
      countryOther: getString(formData, "countryOther", false),
      schoolName: getString(formData, "schoolName", false),
      graduationYear: graduationYearRaw ? parseInt(graduationYearRaw, 10) : undefined,
      subjectsOfInterest: getString(formData, "subjectsOfInterest", false),
      motivation: getString(formData, "motivation", false),
      motivationVideoUrl: getString(formData, "motivationVideoUrl", false),
      teachingExperience: getString(formData, "teachingExperience", false),
      referralEmails: getString(formData, "referralEmails", false),
      courseIdea: getString(formData, "courseIdea", false) || getString(formData, "textbook", false),
      textbook: getString(formData, "textbook", false),
      courseOutline: getString(formData, "courseOutline", false),
      firstClassPlan: getString(formData, "firstClassPlan", false),
      availability: getString(formData, "availability", false),
      hoursPerWeek: hoursPerWeekRaw ? parseInt(hoursPerWeekRaw, 10) : undefined,
      preferredStartDate: getString(formData, "preferredStartDate", false),
    };

    const validation = isSummerWorkshop
      ? summerWorkshopInstructorApplicationSchema.safeParse({
          ...sharedPayload,
          workshopOutline: workshopOutlinePayload,
        })
      : instructorApplicationSchema.safeParse(sharedPayload);
    if (!validation.success) {
      return {
        status: "error",
        message: validation.error.issues[0]?.message || "Please review your application and try again.",
        fields: pickFormFields(formData),
      };
    }
    if (validation.data.country === "Other" && !validation.data.countryOther?.trim()) {
      return {
        status: "error",
        message: "Please specify your country.",
        fields: pickFormFields(formData),
      };
    }
    const input = validation.data;

    // Find the most recent prior application to chain to.
    const priorApp = await prisma.instructorApplication.findFirst({
      where: { applicantId: userRow.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const defaultInitialReviewer = await findDefaultInitialReviewerForChapter(userRow.chapterId);
    const defaultReviewerAssignedAt = defaultInitialReviewer ? new Date() : null;

    const application = await prisma.instructorApplication.create({
      data: {
        applicantId: userRow.id,
        status: defaultInitialReviewer
          ? InstructorApplicationStatus.UNDER_REVIEW
          : InstructorApplicationStatus.SUBMITTED,
        reviewerId: defaultInitialReviewer?.id,
        reviewerAssignedAt: defaultReviewerAssignedAt,
        isReapplication: !!priorApp,
        previousApplicationId: priorApp?.id ?? null,
        motivation: input.motivation || null,
        motivationVideoUrl: input.motivationVideoUrl || null,
        teachingExperience: input.teachingExperience,
        availability: input.availability,
        legalName: input.legalName,
        preferredFirstName: input.preferredFirstName,
        phoneNumber: input.phoneNumber || null,
        dateOfBirth: input.dateOfBirth || null,
        hearAboutYPP: input.hearAboutYPP || null,
        city: input.city,
        stateProvince: input.stateProvince,
        zipCode: input.zipCode,
        country:
          input.country === "Other"
            ? input.countryOther || "Other"
            : input.country,
        schoolName: input.schoolName,
        graduationYear: input.graduationYear,
        subjectsOfInterest: input.subjectsOfInterest || null,
        referralEmails: input.referralEmails || null,
        courseIdea: input.courseIdea,
        textbook: input.textbook || input.courseIdea || null,
        courseOutline: input.courseOutline || null,
        firstClassPlan: input.firstClassPlan || null,
        hoursPerWeek: input.hoursPerWeek,
        preferredStartDate: input.preferredStartDate || null,
        applicationTrack,
        instructorSubtype: isSummerWorkshop
          ? InstructorSubtype.SUMMER_WORKSHOP
          : InstructorSubtype.STANDARD,
        workshopOutline:
          isSummerWorkshop && "workshopOutline" in input
            ? (input.workshopOutline as object)
            : undefined,
        timeline: {
          create: [
            ...(defaultInitialReviewer
              ? [
                  {
                    kind: "REVIEWER_ASSIGNED",
                    actorId: null,
                    payload: {
                      reviewerId: defaultInitialReviewer.id,
                      previousReviewerId: null,
                      defaultAssignment: true,
                      reason: "chapter_president_default",
                    },
                  },
                ]
              : []),
            {
              kind: SUMMER_WORKSHOP_TIMELINE_KINDS.TRACK_SELECTED,
              actorId: null,
              payload: { applicationTrack },
            },
            ...(isSummerWorkshop
              ? [
                  {
                    kind: SUMMER_WORKSHOP_TIMELINE_KINDS.WORKSHOP_OUTLINE_SUBMITTED,
                    actorId: null,
                    payload: { source: "reapplication_submission" },
                  },
                ]
              : []),
            ...(priorApp
              ? [
                  {
                    kind: "REAPPLICATION_SUBMITTED",
                    actorId: userRow.id,
                    payload: { previousApplicationId: priorApp.id },
                  },
                ]
              : []),
          ],
        },
      },
      select: { id: true },
    });

    await syncInstructorApplicationWorkflow(application.id);

    try {
      const { notifyReviewersOfNewApplication } = await import("@/lib/instructor-application-actions");
      await notifyReviewersOfNewApplication(userRow.id);
    } catch (e) {
      console.error("[submitInstructorApplicationForExistingUser] notify failed:", e);
    }
    try {
      const { sendInstructorApplicationSubmittedEmail } = await import("@/lib/email");
      const { toAbsoluteAppUrl } = await import("@/lib/public-app-url");
      await sendInstructorApplicationSubmittedEmail({
        to: userRow.email,
        applicantName: userRow.name,
        statusUrl: toAbsoluteAppUrl("/application-status"),
      });
    } catch (e) {
      console.error("[submitInstructorApplicationForExistingUser] email failed:", e);
    }

    return { status: "success", message: "APPLICATION_SUBMITTED" };
  } catch (error) {
    console.error("[submitInstructorApplicationForExistingUser]", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

export async function signUpParent(prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    const name = getString(formData, "name");
    const email = getString(formData, "email").toLowerCase();
    const password = getString(formData, "password");
    const phone = getString(formData, "phone", false);
    const childEmail = getString(formData, "childEmail", false).toLowerCase();
    const relationship = getString(formData, "relationship", false) || "Parent";

    const rl = checkRateLimit(`signup:${email}`, 5, 15 * 60 * 1000);
    if (!rl.success) {
      return { status: "error", message: "Too many attempts. Please try again later." };
    }

    if (password.length < 8) {
      return { status: "error", message: "Password must be at least 8 characters." };
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return { status: "error", message: "Password must contain at least one letter and one number." };
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return {
        status: "success",
        message: "If this email is not already registered, your account has been created. You can now sign in."
      };
    }

    // Create user in Supabase Auth
    const supabaseAdmin = createServiceClient();
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, primaryRole: RoleType.PARENT },
    });

    if (authError) {
      console.error("[Signup] Supabase auth error:", authError.message);
      return { status: "error", message: "Something went wrong. Please try again." };
    }

    const parent = await upsertPortalUser({
      name,
      email,
      phone,
      primaryRole: RoleType.PARENT,
      supabaseAuthId: authData.user.id,
    });

    // If child email provided, try to link
    if (childEmail) {
      const child = await prisma.user.findUnique({
        where: { email: childEmail },
        include: { roles: true },
      });

      if (child && child.roles.some((r) => r.role === "STUDENT")) {
        await prisma.parentStudent.create({
          data: {
            parentId: parent.id,
            studentId: child.id,
            relationship,
            isPrimary: false,
            approvalStatus: "PENDING",
          },
        });
      }
    }

    return {
      status: "success",
      message: "ACCOUNT_CREATED"
    };
  } catch (error) {
    return {
      status: "error",
      message: "Something went wrong. Please try again."
    };
  }
}
