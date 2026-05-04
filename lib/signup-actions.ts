"use server";

import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/server";
import { InstructorApplicationStatus, RoleType, ApplicationTrack, InstructorSubtype } from "@prisma/client";
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

    // Rate limit: 5 signup attempts per email per 15 minutes
    const rl = checkRateLimit(`signup:${email}`, 5, 15 * 60 * 1000);
    if (!rl.success) {
      return { status: "error", message: "Too many attempts. Please try again later.", fields: pickFormFields(formData) };
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
    const applicationTrack: ApplicationTrack =
      applicationTrackRaw === "SUMMER_WORKSHOP_INSTRUCTOR"
        ? ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR
        : ApplicationTrack.STANDARD_INSTRUCTOR;
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

      const schema = isSummerWorkshop
        ? summerWorkshopInstructorApplicationSchema
        : instructorApplicationSchema;
      const validation = schema.safeParse({
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
        ...(isSummerWorkshop ? { workshopOutline: workshopOutlinePayload } : {}),
      });

      if (!validation.success) {
        return {
          status: "error",
          message: validation.error.issues[0]?.message || "Please review your application and try again.",
          fields: pickFormFields(formData),
        };
      }

      instructorApplicationInput = validation.data;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // M2: Generic message to prevent user enumeration
      return {
        status: "success",
        message: "If this email is not already registered, your account has been created. Please check your email or try signing in."
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

    const newUser = await upsertPortalUser({
      name,
      email,
      phone,
      primaryRole,
      chapterId,
      supabaseAuthId: authData.user.id,
    });

    // If applicant, create the InstructorApplication record with all fields
    if (primaryRole === RoleType.APPLICANT && instructorApplicationInput) {
      const defaultInitialReviewer = await findDefaultInitialReviewerForChapter(chapterId || null);
      const defaultReviewerAssignedAt = defaultInitialReviewer ? new Date() : null;
      const application = await prisma.instructorApplication.create({
        data: {
          applicantId: newUser.id,
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
      });
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
