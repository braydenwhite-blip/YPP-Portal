"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import {
  CourseFormat,
  CourseLevel,
  EventScope,
  EventType,
  EventVisibility,
  MentorshipType,
  RoleType,
  TrainingModuleType
} from "@prisma/client";
import { validateEnum } from "@/lib/validate-enum";
import { logAuditEvent } from "@/lib/audit-log-actions";
import { syncPersonSearchDocument } from "@/lib/help-agent/search-indexing";
import { onProgressEvent } from "@/lib/progress-events";
import { migrateUsersToSupabaseAuth } from "@/lib/supabase-user-migration";
import { createServiceClient } from "@/lib/supabase/server";
import {
  buildUserAdminSubtypeRecords,
  resolveUserAccessSelection,
} from "@/lib/admin-user-access";
import { deriveSpineFromAccess } from "@/lib/org/levels";

export type AdminUserMigrationResult = {
  found: number;
  migrated: number;
  linked: number;
  skipped: number;
  failed: number;
  highlights: Array<{ email: string; status: string; detail: string }>;
};

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session as typeof session & { user: { id: string; roles: string[] } };
}

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

export async function migrateMissingUsers(): Promise<AdminUserMigrationResult> {
  await requireAdmin();

  const result = await migrateUsersToSupabaseAuth();

  revalidatePath("/admin");

  return {
    found: result.found,
    migrated: result.migrated,
    linked: result.linked,
    skipped: result.skipped,
    failed: result.failed,
    highlights: result.logs.slice(0, 5).map((entry) => ({
      email: entry.email,
      status: entry.status,
      detail: entry.detail,
    })),
  };
}

export type CreateUserResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createUser(formData: FormData): Promise<CreateUserResult> {
  try {
    const session = await requireAdmin();
    const name = getString(formData, "name");
    const email = getString(formData, "email").toLowerCase();
    const phone = getString(formData, "phone", false);
    const password = getString(formData, "password");
    const chapterId = getString(formData, "chapterId", false);

    if (password.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters." };
    }

    const access = resolveUserAccessSelection({
      primaryRoleRaw: getString(formData, "primaryRole"),
      roleValues: formData.getAll("roles").map(String),
      adminSubtypeValues: formData.getAll("adminSubtypes").map(String),
      defaultOwnerSubtypeRaw: getString(formData, "defaultOwnerSubtype", false),
    });
    const { primaryRole, roles, adminSubtypes, defaultOwnerSubtype } = access;
    const adminSubtypeCreateData = buildUserAdminSubtypeRecords(
      "user",
      adminSubtypes,
      defaultOwnerSubtype
    ).map(({ subtype, isDefaultOwner }) => ({
      subtype,
      isDefaultOwner,
    }));

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { ok: false, error: "A user with that email already exists." };
    }

    // The org-spine (ladder/level) is the source of truth for access. Derive and
    // persist it from the chosen role/subtypes so new accounts are consistent and
    // the tier guards work off the ladder immediately.
    const spine = deriveSpineFromAccess({
      primaryRole,
      roles,
      adminSubtypes,
      explicitCanonicalTitle: getString(formData, "canonicalTitle", false) || null,
    });

    const passwordHash = await bcrypt.hash(password, 10);
    let supabaseAdmin;
    try {
      supabaseAdmin = createServiceClient();
    } catch (envError) {
      console.error("[Admin] Supabase service client unavailable:", envError);
      return {
        ok: false,
        error:
          "Auth is not configured on this deployment (missing Supabase service credentials).",
      };
    }

    // Pass plaintext password so GoTrue hashes it — same path as public signup.
    // (password_hash is only used for migrating existing bcrypt hashes.)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        primaryRole,
        chapterId: chapterId || null,
        roles,
        internalLevel: spine.internalLevel,
      },
    });

    if (authError || !authData.user?.id) {
      const detail = authError?.message || "No user returned.";
      console.error("[Admin] Failed to create Supabase auth user:", detail);
      if (/already.*(registered|exists)/i.test(detail)) {
        return {
          ok: false,
          error: "That email already has a login. Try a different email or reset their password.",
        };
      }
      return {
        ok: false,
        error: `Could not create the login account: ${detail}`,
      };
    }

    const userWriteData = {
      name,
      email,
      phone: phone || null,
      passwordHash,
      primaryRole,
      chapterId: chapterId || null,
      emailVerified: new Date(),
      supabaseAuthId: authData.user.id,
      internalLevel: spine.internalLevel,
      ladder: spine.ladder ?? undefined,
      canonicalTitle: spine.canonicalTitle ?? undefined,
    };

    let newUser;

    try {
      const existingAfterAuthCreate = await prisma.user.findUnique({
        where: { email },
        select: { id: true, supabaseAuthId: true },
      });

      if (existingAfterAuthCreate) {
        if (
          existingAfterAuthCreate.supabaseAuthId &&
          existingAfterAuthCreate.supabaseAuthId !== authData.user.id
        ) {
          throw new Error("A user with that email already exists.");
        }

        newUser = await prisma.user.update({
          where: { id: existingAfterAuthCreate.id },
          data: {
            ...userWriteData,
            roles: {
              deleteMany: {},
              create: roles.map((role) => ({ role })),
            },
            adminSubtypes: {
              deleteMany: {},
              ...(adminSubtypes.length > 0
                ? {
                    create: adminSubtypeCreateData,
                  }
                : {}),
            },
          },
        });
      } else {
        newUser = await prisma.user.create({
          data: {
            ...userWriteData,
            roles: {
              create: roles.map((role) => ({ role })),
            },
            ...(adminSubtypes.length > 0
              ? {
                  adminSubtypes: {
                    create: adminSubtypeCreateData,
                  },
                }
              : {}),
          },
        });
      }
    } catch (error) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error("[Admin] Failed to clean up Supabase auth user after Prisma error:", cleanupError);
      }
      throw error;
    }

    await logAuditEvent({
      action: "USER_CREATED",
      actorId: session.user.id,
      targetType: "User",
      targetId: newUser.id,
      description: `Created user ${name} (${email}) with role ${primaryRole}`,
      metadata: { roles, primaryRole, adminSubtypes, defaultOwnerSubtype },
    });

    await syncPersonSearchDocument(newUser.id).catch((err) => {
      console.warn("[Admin] Person search sync failed after create:", err);
    });
    revalidatePath("/admin");
    revalidatePath("/people");

    return { ok: true, id: newUser.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create user.";
    console.error("[Admin] createUser failed:", message);
    if (/Unauthorized/i.test(message)) {
      return { ok: false, error: "You need Admin access to create users." };
    }
    if (/Can't reach database|P1001|PrismaClientInitializationError/i.test(message)) {
      return {
        ok: false,
        error: "Database is not reachable from this deployment. Check DATABASE_URL on Vercel.",
      };
    }
    return { ok: false, error: message };
  }
}

export async function createCourse(formData: FormData) {
  const session = await requireAdmin();
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const format = validateEnum(CourseFormat, getString(formData, "format"), "format");
  const levelValue =
    getString(formData, "learnerFit", false) || getString(formData, "level", false);
  const level = levelValue ? (levelValue as CourseLevel) : null;
  if (format === "LEVELED" && !level) {
    throw new Error("Learner fit is required for learner progression courses");
  }
  const interestArea = getString(formData, "interestArea");
  const isVirtual = formData.get("isVirtual") === "on";
  const chapterId = getString(formData, "chapterId", false);
  const leadInstructorId = getString(formData, "leadInstructorId", false);

  const course = await prisma.course.create({
    data: {
      title,
      description,
      format,
      level,
      interestArea,
      isVirtual,
      chapterId: chapterId || null,
      leadInstructorId: leadInstructorId || null
    }
  });

  await logAuditEvent({
    action: "COURSE_CREATED",
    actorId: session.user.id,
    targetType: "Course",
    targetId: course.id,
    description: `Created course "${title}" (${format})`,
  });

  revalidatePath("/admin");
  revalidatePath("/curriculum");
  revalidatePath("/pathways");
}

export async function createPathway(formData: FormData) {
  await requireAdmin();
  const name = getString(formData, "name");
  const description = getString(formData, "description");
  const interestArea = getString(formData, "interestArea");
  const isActive = formData.get("isActive") === "on";

  await prisma.pathway.create({
    data: { name, description, interestArea, isActive }
  });

  revalidatePath("/admin");
  revalidatePath("/pathways");
}

export async function addPathwayStep(formData: FormData) {
  await requireAdmin();
  const pathwayId = getString(formData, "pathwayId");
  const courseId = getString(formData, "courseId");
  const stepOrder = Number(getString(formData, "stepOrder"));

  await prisma.pathwayStep.create({
    data: { pathwayId, courseId, stepOrder }
  });

  revalidatePath("/admin");
  revalidatePath("/pathways");
}

export async function createTrainingModule(formData: FormData) {
  await requireAdmin();
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const materialUrl = getString(formData, "materialUrl", false);
  const materialNotes = getString(formData, "materialNotes", false);
  const type = validateEnum(TrainingModuleType, getString(formData, "type"), "type");
  const required = formData.get("required") === "on";
  const sortOrder = Number(getString(formData, "sortOrder"));

  await prisma.trainingModule.create({
    data: {
      title,
      description,
      materialUrl: materialUrl || null,
      materialNotes: materialNotes || null,
      type,
      required,
      sortOrder
    }
  });

  revalidatePath("/admin");
  revalidatePath("/instructor-training");
}

export async function createEvent(formData: FormData) {
  const session = await requireAdmin();
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const eventType = validateEnum(EventType, getString(formData, "eventType"), "eventType");
  const startDate = new Date(getString(formData, "startDate"));
  const endDate = new Date(getString(formData, "endDate"));
  const chapterId = getString(formData, "chapterId", false);

  await prisma.event.create({
    data: {
      title,
      description,
      eventType,
      scope: chapterId ? EventScope.CHAPTER : EventScope.GLOBAL,
      visibility: chapterId ? EventVisibility.INTERNAL : EventVisibility.PUBLIC,
      startDate,
      endDate,
      chapterId: chapterId || null,
      createdById: session.user.id,
      updatedById: session.user.id,
    }
  });

  revalidatePath("/admin");
  revalidatePath("/events");
}

export async function createMentorship(formData: FormData) {
  await requireAdmin();
  const mentorId = getString(formData, "mentorId");
  const menteeId = getString(formData, "menteeId");
  const type = validateEnum(MentorshipType, getString(formData, "type"), "type");
  const notes = getString(formData, "notes", false);

  await prisma.mentorship.create({
    data: { mentorId, menteeId, type, notes: notes || null }
  });

  revalidatePath("/admin");
  revalidatePath("/mentorship");
}

export async function updateEnrollmentStatus(formData: FormData) {
  const session = await requireAdmin();
  const enrollmentId = getString(formData, "enrollmentId");
  const status = getString(formData, "status");
  if (!["PENDING", "ENROLLED", "DECLINED"].includes(status)) {
    throw new Error("Invalid status");
  }

  const enrollment = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { status },
    include: { user: { select: { name: true } }, course: { select: { title: true } } },
  });

  const action = status === "ENROLLED" ? "ENROLLMENT_APPROVED" : "ENROLLMENT_DECLINED";
  await logAuditEvent({
    action: action as "ENROLLMENT_APPROVED" | "ENROLLMENT_DECLINED",
    actorId: session.user.id,
    targetType: "Enrollment",
    targetId: enrollmentId,
    description: `${status === "ENROLLED" ? "Approved" : "Declined"} enrollment for ${enrollment.user.name} in ${enrollment.course.title}`,
  });

  if (status === "ENROLLED") {
    onProgressEvent({ type: "COURSE_ENROLLED", userId: enrollment.userId, metadata: { courseId: enrollment.courseId } }).catch(() => {});
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/curriculum");
}
