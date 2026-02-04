"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ProgramType } from "@prisma/client";

// ============================================
// BROWSE PROGRAMS
// ============================================

export async function getPrograms(filters?: {
  type?: ProgramType;
  interestArea?: string;
  isVirtual?: boolean;
}) {
  const where: any = {
    isActive: true,
  };

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.interestArea) {
    where.interestArea = filters.interestArea;
  }

  if (filters?.isVirtual !== undefined) {
    where.isVirtual = filters.isVirtual;
  }

  const programs = await prisma.specialProgram.findMany({
    where,
    include: {
      leader: {
        select: { id: true, name: true },
      },
      sessions: {
        where: { scheduledAt: { gte: new Date() } },
        orderBy: { scheduledAt: "asc" },
        take: 3,
      },
      _count: {
        select: { participants: true, sessions: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return programs;
}

export async function getProgramById(programId: string) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const program = await prisma.specialProgram.findUnique({
    where: { id: programId },
    include: {
      leader: {
        select: { id: true, name: true, email: true },
      },
      sessions: {
        orderBy: { scheduledAt: "asc" },
      },
      participants: userId
        ? {
            where: { userId },
          }
        : false,
      _count: {
        select: { participants: true },
      },
    },
  });

  const isEnrolled = userId
    ? (program?.participants?.length || 0) > 0
    : false;

  return { program, isEnrolled };
}

// ============================================
// MY PROGRAMS
// ============================================

export async function getMyPrograms() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const enrollments = await prisma.specialProgramEnrollment.findMany({
    where: { userId: session.user.id },
    include: {
      program: {
        include: {
          leader: {
            select: { id: true, name: true },
          },
          sessions: {
            where: { scheduledAt: { gte: new Date() } },
            orderBy: { scheduledAt: "asc" },
            take: 3,
          },
          _count: {
            select: { sessions: true },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  return enrollments;
}

export async function enrollInProgram(programId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Check if already enrolled
  const existing = await prisma.specialProgramEnrollment.findUnique({
    where: {
      programId_userId: {
        programId,
        userId: session.user.id,
      },
    },
  });

  if (existing) {
    throw new Error("You are already enrolled in this program");
  }

  const enrollment = await prisma.specialProgramEnrollment.create({
    data: {
      programId,
      userId: session.user.id,
    },
  });

  revalidatePath("/programs");
  revalidatePath(`/programs/${programId}`);
  revalidatePath("/programs/my");
  return enrollment;
}

export async function withdrawFromProgram(programId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.specialProgramEnrollment.delete({
    where: {
      programId_userId: {
        programId,
        userId: session.user.id,
      },
    },
  });

  revalidatePath("/programs");
  revalidatePath(`/programs/${programId}`);
  revalidatePath("/programs/my");
}

// ============================================
// ADMIN: MANAGE PROGRAMS
// ============================================

export async function createProgram(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can create programs");
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const interestArea = formData.get("interestArea") as string;
  const type = formData.get("type") as ProgramType;
  const isVirtual = formData.get("isVirtual") === "true";
  const leaderId = formData.get("leaderId") as string || null;

  const program = await prisma.specialProgram.create({
    data: {
      name,
      description,
      interestArea,
      type,
      isVirtual,
      leaderId,
    },
  });

  revalidatePath("/admin/programs");
  revalidatePath("/programs");
  return program;
}

export async function updateProgram(programId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can update programs");
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const interestArea = formData.get("interestArea") as string;
  const type = formData.get("type") as ProgramType;
  const isVirtual = formData.get("isVirtual") === "true";
  const isActive = formData.get("isActive") === "true";
  const leaderId = formData.get("leaderId") as string || null;

  const program = await prisma.specialProgram.update({
    where: { id: programId },
    data: {
      name,
      description,
      interestArea,
      type,
      isVirtual,
      isActive,
      leaderId,
    },
  });

  revalidatePath("/admin/programs");
  revalidatePath("/programs");
  revalidatePath(`/programs/${programId}`);
  return program;
}

export async function addProgramSession(programId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can add sessions");
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const scheduledAt = new Date(formData.get("scheduledAt") as string);
  const duration = parseInt(formData.get("duration") as string) || 60;
  const meetingLink = formData.get("meetingLink") as string;

  const programSession = await prisma.programSession.create({
    data: {
      programId,
      title,
      description,
      scheduledAt,
      duration,
      meetingLink,
    },
  });

  revalidatePath("/admin/programs");
  revalidatePath(`/programs/${programId}`);
  return programSession;
}

export async function deleteProgramSession(sessionId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can delete sessions");
  }

  const programSession = await prisma.programSession.delete({
    where: { id: sessionId },
  });

  revalidatePath("/admin/programs");
  return programSession;
}

export async function getAllProgramsAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can view all programs");
  }

  return prisma.specialProgram.findMany({
    include: {
      leader: {
        select: { id: true, name: true },
      },
      sessions: {
        orderBy: { scheduledAt: "asc" },
      },
      _count: {
        select: { participants: true, sessions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
