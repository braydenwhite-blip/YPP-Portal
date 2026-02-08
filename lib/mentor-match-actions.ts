"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { MentorshipType } from "@prisma/client";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session;
}

export interface MentorMatchSuggestion {
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  mentorChapter: string | null;
  mentorInterests: string[];
  mentorCurrentMentees: number;
  menteeId: string;
  menteeName: string;
  menteeEmail: string;
  menteeChapter: string | null;
  menteeInterests: string[];
  matchScore: number;
  matchReasons: string[];
  type: MentorshipType;
}

export async function computeMentorMatches(type: "INSTRUCTOR" | "STUDENT") {
  await requireAdmin();

  // Get all mentors with profiles and current active mentorships
  const mentors = await prisma.user.findMany({
    where: { roles: { some: { role: "MENTOR" } } },
    include: {
      profile: true,
      chapter: true,
      mentorPairs: {
        where: { status: "ACTIVE" },
      },
    },
  });

  // Get potential mentees based on type
  const menteeRole = type === "INSTRUCTOR" ? "INSTRUCTOR" : "STUDENT";
  const potentialMentees = await prisma.user.findMany({
    where: {
      roles: { some: { role: menteeRole } },
      // Exclude those who already have an active mentorship of this type
      NOT: {
        menteePairs: {
          some: { status: "ACTIVE", type },
        },
      },
    },
    include: {
      profile: true,
      chapter: true,
      menteePairs: { where: { status: "ACTIVE" } },
    },
  });

  if (mentors.length === 0 || potentialMentees.length === 0) {
    return [];
  }

  const suggestions: MentorMatchSuggestion[] = [];

  for (const mentee of potentialMentees) {
    const menteeInterests = mentee.profile?.interests ?? [];
    const menteeChapterId = mentee.chapterId;

    let bestMatch: MentorMatchSuggestion | null = null;
    let bestScore = -1;

    for (const mentor of mentors) {
      // Don't match someone to themselves
      if (mentor.id === mentee.id) continue;

      const mentorInterests = mentor.profile?.interests ?? [];
      const mentorChapterId = mentor.chapterId;
      const currentMenteeCount = mentor.mentorPairs.length;

      let score = 0;
      const reasons: string[] = [];

      // Shared interests (up to 40 points)
      const sharedInterests = menteeInterests.filter((i) =>
        mentorInterests.some((mi) => mi.toLowerCase() === i.toLowerCase())
      );
      if (sharedInterests.length > 0) {
        const interestScore = Math.min(sharedInterests.length * 10, 40);
        score += interestScore;
        reasons.push(
          `${sharedInterests.length} shared interest${sharedInterests.length > 1 ? "s" : ""}: ${sharedInterests.join(", ")}`
        );
      }

      // Same chapter (20 points)
      if (
        menteeChapterId &&
        mentorChapterId &&
        menteeChapterId === mentorChapterId
      ) {
        score += 20;
        reasons.push(`Same chapter: ${mentor.chapter?.name ?? "Unknown"}`);
      }

      // Lower workload preference (up to 30 points)
      const workloadScore = Math.max(0, 30 - currentMenteeCount * 10);
      score += workloadScore;
      if (currentMenteeCount === 0) {
        reasons.push("Mentor has no current mentees");
      } else if (currentMenteeCount <= 2) {
        reasons.push(`Mentor has ${currentMenteeCount} current mentee${currentMenteeCount > 1 ? "s" : ""}`);
      } else {
        reasons.push(`Mentor has ${currentMenteeCount} mentees (high load)`);
      }

      // Bonus for having a profile set up (10 points)
      if (mentor.profile?.bio) {
        score += 10;
        reasons.push("Mentor has a complete profile");
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          mentorId: mentor.id,
          mentorName: mentor.name,
          mentorEmail: mentor.email,
          mentorChapter: mentor.chapter?.name ?? null,
          mentorInterests,
          mentorCurrentMentees: currentMenteeCount,
          menteeId: mentee.id,
          menteeName: mentee.name,
          menteeEmail: mentee.email,
          menteeChapter: mentee.chapter?.name ?? null,
          menteeInterests,
          matchScore: score,
          matchReasons: reasons,
          type,
        };
      }
    }

    if (bestMatch) {
      suggestions.push(bestMatch);
    }
  }

  // Sort by score descending
  suggestions.sort((a, b) => b.matchScore - a.matchScore);

  return suggestions;
}

export async function approveMentorMatch(formData: FormData) {
  await requireAdmin();

  const mentorId = formData.get("mentorId") as string;
  const menteeId = formData.get("menteeId") as string;
  const type = formData.get("type") as MentorshipType;

  if (!mentorId || !menteeId || !type) {
    throw new Error("Missing required fields");
  }

  // Check if mentorship already exists
  const existing = await prisma.mentorship.findFirst({
    where: { mentorId, menteeId, type, status: "ACTIVE" },
  });

  if (existing) {
    throw new Error("This mentorship pairing already exists");
  }

  await prisma.mentorship.create({
    data: {
      mentorId,
      menteeId,
      type,
      notes: "Created via Mentor Match Algorithm",
    },
  });

  revalidatePath("/admin/mentor-match");
  revalidatePath("/mentorship");
}
