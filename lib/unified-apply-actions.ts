"use server";

import bcrypt from "bcryptjs";
import {
  ApplicationSource,
  ApplicationTrack,
  InstructorApplicationStatus,
  RoleType,
} from "@prisma/client";

import { ensureTechnologyManagerPosition } from "@/lib/application-actions";
import { TECHNOLOGY_MANAGER_KIND } from "@/lib/technology-manager-application";
import { isRegularInstructorEnabled } from "@/lib/feature-flags";
import { establishLegacySession } from "@/lib/legacy-auth-server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { canUseLocalPasswordFallback } from "@/lib/supabase/config";
import { createServiceClient } from "@/lib/supabase/server";

export type UnifiedApplyState = {
  status: "idle" | "error" | "success";
  message: string;
};

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`${key} is required.`);
  }
  return value ? String(value).trim() : "";
}

async function createApplicantUser(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<{ userId: string; mode: "local" | "supabase" }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error("ACCOUNT_EXISTS_SIGNIN_REQUIRED");
  }

  if (canUseLocalPasswordFallback()) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        passwordHash,
        primaryRole: RoleType.APPLICANT,
        emailVerified: new Date(),
        roles: { create: [{ role: RoleType.APPLICANT }] },
      },
    });
    await establishLegacySession({
      userId: user.id,
      email: user.email,
      mode: "LOCAL_PASSWORD_FALLBACK",
      primaryRole: user.primaryRole,
      roles: [RoleType.APPLICANT],
    });
    return { userId: user.id, mode: "local" };
  }

  const supabaseAdmin = createServiceClient();
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name, primaryRole: RoleType.APPLICANT },
  });

  if (authError || !authData.user?.id) {
    throw new Error("Something went wrong creating your account. Please try again.");
  }

  try {
    const user = await prisma.user.upsert({
      where: { email: input.email },
      update: {
        name: input.name,
        phone: input.phone || null,
        passwordHash: "",
        primaryRole: RoleType.APPLICANT,
        emailVerified: new Date(),
        supabaseAuthId: authData.user.id,
      },
      create: {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        passwordHash: "",
        primaryRole: RoleType.APPLICANT,
        emailVerified: new Date(),
        supabaseAuthId: authData.user.id,
        roles: { create: [{ role: RoleType.APPLICANT }] },
      },
    });
    await prisma.userRole.upsert({
      where: { userId_role: { userId: user.id, role: RoleType.APPLICANT } },
      update: {},
      create: { userId: user.id, role: RoleType.APPLICANT },
    });
    return { userId: user.id, mode: "supabase" };
  } catch (err) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

async function appendWaitlist(kind: "instructor" | "cp" | "staff", id: string) {
  try {
    const { appendHiringWaitlistKey } = await import("@/lib/hiring-waitlist/order-store");
    const { waitlistKey } = await import("@/lib/hiring-waitlist/types");
    await appendHiringWaitlistKey(waitlistKey(kind, id));
  } catch (err) {
    console.error("[unifiedApply] waitlist append failed", err);
  }
}

/**
 * One apply action for Instructor / Chapter President / Technology Manager.
 * Creates the applicant account + the matching application row.
 */
export async function submitUnifiedApply(
  _prev: UnifiedApplyState,
  formData: FormData
): Promise<UnifiedApplyState> {
  try {
    const role = getString(formData, "hiringRole");
    if (role !== "instructor" && role !== "cp" && role !== "staff") {
      return { status: "error", message: "Choose a role to apply for." };
    }

    const name = getString(formData, "name");
    const email = getString(formData, "email").toLowerCase();
    const password = getString(formData, "password");
    const phone = getString(formData, "phoneNumber");
    const preferredFirstName =
      getString(formData, "preferredFirstName", false) || name.split(/\s+/)[0] || name;
    const lastName =
      getString(formData, "lastName", false) || name.split(/\s+/).slice(1).join(" ") || name;
    const legalName =
      getString(formData, "legalName", false) ||
      [preferredFirstName, lastName].filter(Boolean).join(" ") ||
      name;
    const dateOfBirth = getString(formData, "dateOfBirth", false);
    const hearAboutYPP = getString(formData, "hearAboutYPP", false);
    const city = getString(formData, "city");
    const stateProvince = getString(formData, "stateProvince");
    const zipCode = getString(formData, "zipCode", false) || null;
    const country = getString(formData, "country", false) || "United States";
    const schoolName = getString(formData, "schoolName");
    const graduationYearRaw = getString(formData, "graduationYear");
    const graduationYear = parseInt(graduationYearRaw, 10);
    const chapterId = getString(formData, "chapterId", false) || null;

    const rl = checkRateLimit(`unified-apply:email:${email}`, 5, 15 * 60 * 1000);
    if (!rl.success) {
      return { status: "error", message: "Too many attempts. Please try again later." };
    }

    if (password.length < 8) {
      return { status: "error", message: "Password must be at least 8 characters." };
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return {
        status: "error",
        message: "Password must contain at least one letter and one number.",
      };
    }
    if (!Number.isFinite(graduationYear)) {
      return { status: "error", message: "Enter a valid graduation year." };
    }

    // Role-specific validation before creating the account
    let schoolType = "";
    let grade = "";
    let documentUrl = "";
    let subjectsOfInterest = "";
    let teachingExperience = "";
    let availability = "";
    let programmingExperience = "";

    if (role === "instructor") {
      grade = getString(formData, "grade", false);
      subjectsOfInterest = getString(formData, "subjectsOfInterest", false);
      teachingExperience = getString(formData, "teachingExperience");
      availability = getString(formData, "availability");
    } else if (role === "cp") {
      schoolType = getString(formData, "schoolType");
      grade = getString(formData, "grade");
      documentUrl = getString(formData, "documentUrl", false);
    } else {
      grade = getString(formData, "grade");
      programmingExperience = getString(formData, "programmingExperience");
      if (!["9", "10", "11", "12"].includes(grade)) {
        return { status: "error", message: "Select your grade (9th–12th)." };
      }
    }

    const { userId, mode } = await createApplicantUser({
      name,
      email,
      password,
      phone,
    });

    if (chapterId) {
      await prisma.user.update({
        where: { id: userId },
        data: { chapterId },
      }).catch(() => {
        /* chapter optional */
      });
    }

    if (role === "instructor") {
      const track = isRegularInstructorEnabled()
        ? ApplicationTrack.STANDARD_INSTRUCTOR
        : ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR;

      const application = await prisma.instructorApplication.create({
        data: {
          applicantId: userId,
          source: ApplicationSource.PORTAL,
          status: InstructorApplicationStatus.WAITLISTED,
          applicationTrack: track,
          preferredFirstName,
          lastName,
          legalName,
          phoneNumber: phone,
          dateOfBirth: dateOfBirth || null,
          hearAboutYPP: hearAboutYPP || null,
          schoolName,
          city,
          stateProvince,
          zipCode,
          country,
          graduationYear,
          subjectsOfInterest:
            `${subjectsOfInterest}${grade ? ` · Grade ${grade}` : ""}`.trim() || null,
          teachingExperience,
          availability,
          motivation: teachingExperience,
        },
      });

      // Hire waitlist is standard/new apps only — summer workshop stays off it.
      if (track === ApplicationTrack.STANDARD_INSTRUCTOR) {
        await appendWaitlist("instructor", application.id);
      }
    } else if (role === "cp") {
      const application = await prisma.chapterPresidentApplication.create({
        data: {
          applicantId: userId,
          chapterId,
          status: "WAITLISTED",
          preferredFirstName,
          lastName,
          legalName,
          phoneNumber: phone,
          dateOfBirth: dateOfBirth || null,
          hearAboutYPP: hearAboutYPP || null,
          country,
          city,
          stateProvince,
          zipCode,
          schoolName: `${schoolName} (${schoolType})`,
          grade,
          graduationYear,
          documentUrl: documentUrl || null,
          leadershipExperience:
            "Submitted via unified YPP apply form. Full leadership prompts collected later if needed.",
          chapterVision:
            "Applicant selected Chapter President on the unified apply form.",
          availability: "To be confirmed in follow-up.",
          whyChapterPresident:
            "Interested in coordinating a local YPP chapter — see supporting document if provided.",
        },
      });
      await appendWaitlist("cp", application.id);
    } else {

      const position = await ensureTechnologyManagerPosition();
      if (!position.isOpen) {
        return {
          status: "error",
          message: "Technology Manager applications are not open right now.",
        };
      }

      const location = `${city}, ${stateProvince}${zipCode ? ` ${zipCode}` : ""}`;
      const metadata = {
        kind: TECHNOLOGY_MANAGER_KIND,
        school: schoolName,
        grade,
        platforms: "Technology / programming",
        experience: programmingExperience,
        contentIdeas: "Submitted via unified apply form.",
        weeklyAvailability: "To be confirmed",
        additionalNotes: [
          `Location: ${location}`,
          country ? `Country: ${country}` : null,
          `Graduation year: ${graduationYear}`,
          legalName ? `Legal name: ${legalName}` : null,
          dateOfBirth ? `DOB: ${dateOfBirth}` : null,
          hearAboutYPP ? `Heard about YPP: ${hearAboutYPP}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        phone,
        location,
      };

      const application = await prisma.application.create({
        data: {
          positionId: position.id,
          applicantId: userId,
          status: "WAITLISTED",
          coverLetter: programmingExperience,
          additionalMaterials: JSON.stringify(metadata),
        },
      });
      await appendWaitlist("staff", application.id);
    }

    return {
      status: "success",
      message: mode === "local" ? "ACCOUNT_CREATED_LOCAL" : "ACCOUNT_CREATED",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    if (message === "ACCOUNT_EXISTS_SIGNIN_REQUIRED") {
      return { status: "error", message };
    }
    console.error("[submitUnifiedApply]", error);
    return {
      status: "error",
      message: message.includes("required")
        ? message.replace(/_/g, " ")
        : "Something went wrong. Please try again.",
    };
  }
}
