"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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

// ============================================
// USER PROFILE MANAGEMENT
// ============================================

export async function updateProfile(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;

  const bio = getString(formData, "bio", false);
  const avatarUrl = getString(formData, "avatarUrl", false);
  const curriculumUrl = getString(formData, "curriculumUrl", false);
  const interests = formData.getAll("interests").map(String).filter(Boolean);
  const grade = getString(formData, "grade", false);
  const school = getString(formData, "school", false);
  const parentEmail = getString(formData, "parentEmail", false);
  const parentPhone = getString(formData, "parentPhone", false);

  await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      bio: bio || null,
      avatarUrl: avatarUrl || null,
      curriculumUrl: curriculumUrl || null,
      interests,
      grade: grade ? Number(grade) : null,
      school: school || null,
      parentEmail: parentEmail || null,
      parentPhone: parentPhone || null
    },
    update: {
      bio: bio || null,
      avatarUrl: avatarUrl || null,
      curriculumUrl: curriculumUrl || null,
      interests,
      grade: grade ? Number(grade) : null,
      school: school || null,
      parentEmail: parentEmail || null,
      parentPhone: parentPhone || null
    }
  });

  revalidatePath("/profile");
  revalidatePath(`/profile/${userId}`);
}

export async function updateBasicInfo(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;

  const name = getString(formData, "name");
  const phone = getString(formData, "phone", false);

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      phone: phone || null
    }
  });

  revalidatePath("/profile");
}

// ============================================
// CURRICULUM SUBMISSION (Instructors)
// ============================================

export async function submitCurriculum(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];

  if (!roles.includes("INSTRUCTOR")) {
    throw new Error("Only instructors can submit curriculum");
  }

  const curriculumUrl = getString(formData, "curriculumUrl");
  const notes = getString(formData, "notes", false);

  await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      curriculumUrl
    },
    update: {
      curriculumUrl
    }
  });

  // Add a feedback entry for curriculum submission (for tracking)
  if (notes) {
    await prisma.feedback.create({
      data: {
        source: "PEER",
        comments: `Curriculum submitted: ${notes}`,
        instructorId: userId,
        authorId: userId
      }
    });
  }

  revalidatePath("/profile");
  revalidatePath("/instructor-training");
  revalidatePath("/instructor-training/curriculum");
}

// ============================================
// ADMIN PROFILE VIEWING
// ============================================

export async function getFullUserProfile(userId: string) {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  const currentUserId = session?.user?.id;

  // Users can view their own profile, admins can view any
  if (currentUserId !== userId && !roles.includes("ADMIN") && !roles.includes("MENTOR") && !roles.includes("CHAPTER_LEAD")) {
    throw new Error("Unauthorized to view this profile");
  }

  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: true,
      chapter: true,
      profile: true,
      courses: true,
      enrollments: {
        include: { course: true }
      },
      trainings: {
        include: { module: true }
      },
      approvals: {
        include: { levels: true }
      },
      mentorPairs: {
        include: { mentee: { select: { id: true, name: true, email: true } } }
      },
      menteePairs: {
        include: { mentor: { select: { id: true, name: true, email: true } } }
      },
      awards: true,
      goals: {
        include: {
          template: true,
          progress: {
            orderBy: { createdAt: "desc" },
            take: 1
          }
        }
      },
      certificates: {
        include: { template: true, course: true, pathway: true }
      }
    }
  });
}
