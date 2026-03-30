"use server";

import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/server";
import { RoleType } from "@prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { instructorApplicationSchema, type InstructorApplicationInput } from "@/lib/application-schemas";

type FormState = {
  status: "idle" | "error" | "success";
  message: string;
};

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
      return { status: "error", message: "Too many attempts. Please try again later." };
    }

    // M1: Stronger password policy (8+ chars, at least one number and one letter)
    if (password.length < 8) {
      return { status: "error", message: "Password must be at least 8 characters." };
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return { status: "error", message: "Password must contain at least one letter and one number." };
    }

    let instructorApplicationInput: InstructorApplicationInput | null = null;

    if (primaryRole === RoleType.APPLICANT) {
      const graduationYearRaw = getString(formData, "graduationYear", false);
      const hoursPerWeekRaw = getString(formData, "hoursPerWeek", false);

      const validation = instructorApplicationSchema.safeParse({
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
        gpa: getString(formData, "gpa", false),
        classRank: getString(formData, "classRank", false),
        subjectsOfInterest: getString(formData, "subjectsOfInterest", false),
        motivation: getString(formData, "motivation", false),
        motivationVideoUrl: getString(formData, "motivationVideoUrl", false),
        whyYPP: getString(formData, "whyYPP", false),
        teachingExperience: getString(formData, "teachingExperience", false),
        extracurriculars: getString(formData, "extracurriculars", false),
        priorLeadership: getString(formData, "priorLeadership", false),
        specialSkills: getString(formData, "specialSkills", false),
        referralEmails: getString(formData, "referralEmails", false),
        availability: getString(formData, "availability", false),
        hoursPerWeek: hoursPerWeekRaw ? parseInt(hoursPerWeekRaw, 10) : undefined,
        preferredStartDate: getString(formData, "preferredStartDate", false),
        ethnicity: getString(formData, "ethnicity", false),
      });

      if (!validation.success) {
        return {
          status: "error",
          message: validation.error.issues[0]?.message || "Please review your application and try again.",
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

    if (authError) {
      console.error("[Signup] Supabase auth error:", authError.message);
      return { status: "error", message: "Something went wrong. Please try again." };
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
      await prisma.instructorApplication.create({
        data: {
          applicantId: newUser.id,
          motivation: instructorApplicationInput.motivation || null,
          motivationVideoUrl: instructorApplicationInput.motivationVideoUrl,
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
          gpa: instructorApplicationInput.gpa || null,
          classRank: instructorApplicationInput.classRank || null,
          subjectsOfInterest: instructorApplicationInput.subjectsOfInterest || null,
          whyYPP: instructorApplicationInput.whyYPP,
          extracurriculars: instructorApplicationInput.extracurriculars,
          priorLeadership: instructorApplicationInput.priorLeadership,
          specialSkills: instructorApplicationInput.specialSkills || null,
          referralEmails: instructorApplicationInput.referralEmails || null,
          hoursPerWeek: instructorApplicationInput.hoursPerWeek,
          preferredStartDate: instructorApplicationInput.preferredStartDate || null,
          ethnicity: instructorApplicationInput.ethnicity || null,
        },
      });
    }

    // Notify reviewers of new applicant (non-blocking)
    if (primaryRole === RoleType.APPLICANT) {
      try {
        const { notifyReviewersOfNewApplication } = await import("@/lib/instructor-application-actions");
        await notifyReviewersOfNewApplication(newUser.id);
      } catch (notifyError) {
        console.error("[Signup] Failed to notify reviewers:", notifyError);
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
