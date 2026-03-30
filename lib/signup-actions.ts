"use server";

import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/server";
import { RoleType } from "@prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";

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

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash: "", // Passwords now managed by Supabase Auth
        primaryRole,
        chapterId: chapterId || null,
        emailVerified: new Date(),
        supabaseAuthId: authData.user.id,
        roles: {
          create: [{ role: primaryRole }]
        }
      }
    });

    // If applicant, create the InstructorApplication record with all fields
    if (primaryRole === RoleType.APPLICANT) {
      const motivation = getString(formData, "motivation");
      const teachingExperience = getString(formData, "teachingExperience");
      const availability = getString(formData, "availability");

      // Personal info
      const legalName = getString(formData, "legalName", false);
      const preferredFirstName = getString(formData, "preferredFirstName", false);
      const phoneNumber = getString(formData, "phoneNumber", false);
      const dateOfBirth = getString(formData, "dateOfBirth", false);
      const hearAboutYPP = getString(formData, "hearAboutYPP", false);

      // Location
      const city = getString(formData, "city", false);
      const stateProvince = getString(formData, "stateProvince", false);
      const zipCode = getString(formData, "zipCode", false);
      const country = getString(formData, "country", false) || "United States";
      const countryOther = getString(formData, "countryOther", false);

      // Academic
      const schoolName = getString(formData, "schoolName", false);
      const graduationYearRaw = getString(formData, "graduationYear", false);
      const graduationYear = graduationYearRaw ? parseInt(graduationYearRaw, 10) : null;
      const gpa = getString(formData, "gpa", false);
      const classRank = getString(formData, "classRank", false);
      const subjectsOfInterest = getString(formData, "subjectsOfInterest", false);

      // Essays
      const whyYPP = getString(formData, "whyYPP", false);
      const extracurriculars = getString(formData, "extracurriculars", false);
      const priorLeadership = getString(formData, "priorLeadership", false);
      const specialSkills = getString(formData, "specialSkills", false);

      // Referral
      const referralEmails = getString(formData, "referralEmails", false);

      // Availability details
      const hoursPerWeekRaw = getString(formData, "hoursPerWeek", false);
      const hoursPerWeek = hoursPerWeekRaw ? parseInt(hoursPerWeekRaw, 10) : null;
      const preferredStartDate = getString(formData, "preferredStartDate", false);

      // Demographics
      const ethnicity = getString(formData, "ethnicity", false);

      await prisma.instructorApplication.create({
        data: {
          applicantId: newUser.id,
          motivation,
          teachingExperience,
          availability,
          legalName: legalName || null,
          preferredFirstName: preferredFirstName || null,
          phoneNumber: phoneNumber || null,
          dateOfBirth: dateOfBirth || null,
          hearAboutYPP: hearAboutYPP || null,
          city: city || null,
          stateProvince: stateProvince || null,
          zipCode: zipCode || null,
          country: country === "Other" ? (countryOther || "Other") : country,
          schoolName: schoolName || null,
          graduationYear: graduationYear && !isNaN(graduationYear) ? graduationYear : null,
          gpa: gpa || null,
          classRank: classRank || null,
          subjectsOfInterest: subjectsOfInterest || null,
          whyYPP: whyYPP || null,
          extracurriculars: extracurriculars || null,
          priorLeadership: priorLeadership || null,
          specialSkills: specialSkills || null,
          referralEmails: referralEmails || null,
          hoursPerWeek: hoursPerWeek && !isNaN(hoursPerWeek) ? hoursPerWeek : null,
          preferredStartDate: preferredStartDate || null,
          ethnicity: ethnicity || null,
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

    const parent = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash: "", // Passwords now managed by Supabase Auth
        primaryRole: RoleType.PARENT,
        emailVerified: new Date(),
        supabaseAuthId: authData.user.id,
        roles: {
          create: [{ role: RoleType.PARENT }]
        }
      }
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
