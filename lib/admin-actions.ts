"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import {
  CourseFormat,
  CourseLevel,
  EventType,
  MentorshipType,
  RoleType,
  TrainingModuleType
} from "@prisma/client";
import { validateEnum } from "@/lib/validate-enum";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session;
}

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

export async function createUser(formData: FormData) {
  await requireAdmin();
  const name = getString(formData, "name");
  const email = getString(formData, "email");
  const phone = getString(formData, "phone", false);
  const password = getString(formData, "password");
  const primaryRole = validateEnum(RoleType, getString(formData, "primaryRole"), "primaryRole");
  const chapterId = getString(formData, "chapterId", false);
  const selectedRoles = formData.getAll("roles").map((role) => validateEnum(RoleType, String(role), "role"));
  const roles = selectedRoles.length ? selectedRoles : [primaryRole];
  if (!roles.includes(primaryRole)) {
    roles.push(primaryRole);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("User already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      passwordHash,
      primaryRole,
      chapterId: chapterId || null,
      roles: {
        create: roles.map((role) => ({ role }))
      }
    }
  });

  revalidatePath("/admin");
}

export async function createCourse(formData: FormData) {
  await requireAdmin();
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const format = validateEnum(CourseFormat, getString(formData, "format"), "format");
  const levelValue = getString(formData, "level", false);
  const level = levelValue ? (levelValue as CourseLevel) : null;
  if (format === "LEVELED" && !level) {
    throw new Error("Level is required for leveled courses");
  }
  const interestArea = getString(formData, "interestArea");
  const isVirtual = formData.get("isVirtual") === "on";
  const chapterId = getString(formData, "chapterId", false);
  const leadInstructorId = getString(formData, "leadInstructorId", false);

  await prisma.course.create({
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
  await requireAdmin();
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
      startDate,
      endDate,
      chapterId: chapterId || null
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
  await requireAdmin();
  const enrollmentId = getString(formData, "enrollmentId");
  const status = getString(formData, "status");
  if (!["PENDING", "ENROLLED", "DECLINED"].includes(status)) {
    throw new Error("Invalid status");
  }

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { status }
  });

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/curriculum");
}
