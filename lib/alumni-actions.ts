"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AwardType } from "@prisma/client";

// ============================================
// AWARD TIER CHECKS
// ============================================

const BRONZE_AWARDS: AwardType[] = [
  "BRONZE_INSTRUCTOR",
  "BRONZE_ACHIEVEMENT",
  "SILVER_INSTRUCTOR",
  "SILVER_ACHIEVEMENT",
  "GOLD_INSTRUCTOR",
  "GOLD_ACHIEVEMENT",
];

const SILVER_AWARDS: AwardType[] = [
  "SILVER_INSTRUCTOR",
  "SILVER_ACHIEVEMENT",
  "GOLD_INSTRUCTOR",
  "GOLD_ACHIEVEMENT",
];

const GOLD_AWARDS: AwardType[] = ["GOLD_INSTRUCTOR", "GOLD_ACHIEVEMENT"];

export async function getUserAwardTier(userId?: string) {
  const session = await getServerSession(authOptions);
  const targetUserId = userId || session?.user?.id;

  if (!targetUserId) return null;

  const awards = await prisma.award.findMany({
    where: {
      recipientId: targetUserId,
      type: { not: null },
    },
    select: { type: true },
  });

  const awardTypes = awards.map((a) => a.type).filter(Boolean) as AwardType[];

  if (awardTypes.some((t) => GOLD_AWARDS.includes(t))) {
    return "GOLD";
  }
  if (awardTypes.some((t) => SILVER_AWARDS.includes(t))) {
    return "SILVER";
  }
  if (awardTypes.some((t) => BRONZE_AWARDS.includes(t))) {
    return "BRONZE";
  }
  return null;
}

export async function canAccessAlumniDirectory() {
  const tier = await getUserAwardTier();
  return tier !== null;
}

export async function canAccessCollegeAdvisor() {
  const tier = await getUserAwardTier();
  return tier === "SILVER" || tier === "GOLD";
}

// ============================================
// ALUMNI DIRECTORY
// ============================================

export async function getAlumniDirectory(filters?: {
  graduationYear?: number;
  college?: string;
  major?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Check access
  const hasAccess = await canAccessAlumniDirectory();
  if (!hasAccess) {
    throw new Error("You need at least a Bronze award to access the alumni directory");
  }

  const where: any = {
    isVisible: true,
  };

  if (filters?.graduationYear) {
    where.graduationYear = filters.graduationYear;
  }

  if (filters?.college) {
    where.college = { contains: filters.college, mode: "insensitive" };
  }

  if (filters?.major) {
    where.major = { contains: filters.major, mode: "insensitive" };
  }

  const alumni = await prisma.alumniProfile.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          awards: {
            orderBy: { awardedAt: "desc" },
            take: 3,
          },
        },
      },
    },
    orderBy: [{ graduationYear: "desc" }, { user: { name: "asc" } }],
  });

  return alumni;
}

export async function getAlumniProfile(alumniId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const hasAccess = await canAccessAlumniDirectory();
  if (!hasAccess) {
    throw new Error("You need at least a Bronze award to view alumni profiles");
  }

  return prisma.alumniProfile.findUnique({
    where: { id: alumniId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          awards: {
            orderBy: { awardedAt: "desc" },
          },
        },
      },
    },
  });
}

// ============================================
// ALUMNI EVENTS
// ============================================

export async function getAlumniEvents() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const hasAccess = await canAccessAlumniDirectory();
  if (!hasAccess) {
    throw new Error("You need at least a Bronze award to view alumni events");
  }

  return prisma.event.findMany({
    where: {
      isAlumniOnly: true,
      startDate: { gte: new Date() },
    },
    include: {
      chapter: true,
      rsvps: {
        where: { userId: session.user.id },
      },
      _count: {
        select: { rsvps: true },
      },
    },
    orderBy: { startDate: "asc" },
  });
}

export async function rsvpToAlumniEvent(eventId: string, status: "GOING" | "MAYBE" | "NOT_GOING") {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const hasAccess = await canAccessAlumniDirectory();
  if (!hasAccess) {
    throw new Error("You need at least a Bronze award to RSVP to alumni events");
  }

  const rsvp = await prisma.eventRsvp.upsert({
    where: {
      eventId_userId: {
        eventId,
        userId: session.user.id,
      },
    },
    create: {
      eventId,
      userId: session.user.id,
      status,
    },
    update: {
      status,
    },
  });

  revalidatePath("/alumni/events");
  return rsvp;
}

// ============================================
// COLLEGE ADVISOR
// ============================================

export async function getMyCollegeAdvisor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const hasAccess = await canAccessCollegeAdvisor();
  if (!hasAccess) {
    throw new Error("You need at least a Silver award to access college advisors");
  }

  const advisorship = await prisma.collegeAdvisorship.findFirst({
    where: {
      adviseeId: session.user.id,
      endDate: null,
    },
    include: {
      advisor: {
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      },
    },
  });

  return advisorship;
}

export async function getAvailableAdvisors() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const hasAccess = await canAccessCollegeAdvisor();
  if (!hasAccess) {
    throw new Error("You need at least a Silver award to view advisors");
  }

  return prisma.collegeAdvisor.findMany({
    where: { isActive: true },
    include: {
      user: {
        select: { id: true, name: true },
      },
      _count: {
        select: { advisees: true },
      },
    },
    orderBy: { user: { name: "asc" } },
  });
}

export async function requestAdvisor(advisorId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const hasAccess = await canAccessCollegeAdvisor();
  if (!hasAccess) {
    throw new Error("You need at least a Silver award to request an advisor");
  }

  // Check if already has an advisor
  const existing = await prisma.collegeAdvisorship.findFirst({
    where: {
      adviseeId: session.user.id,
      endDate: null,
    },
  });

  if (existing) {
    throw new Error("You already have an assigned college advisor");
  }

  const advisorship = await prisma.collegeAdvisorship.create({
    data: {
      advisorId,
      adviseeId: session.user.id,
    },
  });

  revalidatePath("/college-advisor");
  return advisorship;
}

// ============================================
// MY ALUMNI PROFILE
// ============================================

export async function getMyAlumniProfile() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  return prisma.alumniProfile.findUnique({
    where: { userId: session.user.id },
  });
}

export async function updateMyAlumniProfile(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const graduationYear = parseInt(formData.get("graduationYear") as string) || null;
  const college = formData.get("college") as string;
  const major = formData.get("major") as string;
  const currentRole = formData.get("currentRole") as string;
  const bio = formData.get("bio") as string;
  const isVisible = formData.get("isVisible") === "true";

  const profile = await prisma.alumniProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      graduationYear,
      college,
      major,
      currentRole,
      bio,
      isVisible,
    },
    update: {
      graduationYear,
      college,
      major,
      currentRole,
      bio,
      isVisible,
    },
  });

  revalidatePath("/alumni");
  return profile;
}

// ============================================
// MY AWARDS
// ============================================

export async function getMyAwards() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const awards = await prisma.award.findMany({
    where: { recipientId: session.user.id },
    orderBy: { awardedAt: "desc" },
  });

  const tier = await getUserAwardTier();

  return { awards, tier };
}

// ============================================
// ADMIN: MANAGE ALUMNI
// ============================================

export async function getAllAlumniProfiles() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can view all alumni");
  }

  return prisma.alumniProfile.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          awards: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function grantAward(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can grant awards");
  }

  const recipientId = formData.get("recipientId") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const type = formData.get("type") as AwardType | null;

  const award = await prisma.award.create({
    data: {
      recipientId,
      name,
      description,
      type,
    },
  });

  revalidatePath("/admin/alumni");
  return award;
}

export async function assignCollegeAdvisor(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can assign advisors");
  }

  const advisorUserId = formData.get("advisorUserId") as string;
  const adviseeId = formData.get("adviseeId") as string;

  // Get or create advisor profile
  let advisor = await prisma.collegeAdvisor.findUnique({
    where: { userId: advisorUserId },
  });

  if (!advisor) {
    const college = formData.get("college") as string || "TBD";
    advisor = await prisma.collegeAdvisor.create({
      data: {
        userId: advisorUserId,
        college,
        isActive: true,
      },
    });
  }

  // Create advisorship
  const advisorship = await prisma.collegeAdvisorship.create({
    data: {
      advisorId: advisor.id,
      adviseeId,
    },
  });

  revalidatePath("/admin/alumni");
  return advisorship;
}

export async function createCollegeAdvisor(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can create advisors");
  }

  const userId = formData.get("userId") as string;
  const college = formData.get("college") as string;
  const major = formData.get("major") as string;
  const availability = formData.get("availability") as string;
  const bio = formData.get("bio") as string;

  const advisor = await prisma.collegeAdvisor.create({
    data: {
      userId,
      college,
      major,
      availability,
      bio,
      isActive: true,
    },
  });

  revalidatePath("/admin/alumni");
  return advisor;
}
