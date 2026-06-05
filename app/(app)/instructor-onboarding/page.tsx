import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { getInstructorJourney } from "@/lib/instructor-journey";
import { getTrainingHomeModel } from "@/lib/training-home-model";
import InstructorLaunchpad from "@/components/instructor-onboarding/instructor-onboarding-guide";

export const metadata: Metadata = {
  title: "Instructor Launchpad | YPP Portal",
};

export default async function InstructorOnboardingPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/instructor-onboarding");
  }

  const [user, application, journey, training] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        profile: {
          select: {
            bio: true,
            school: true,
            interests: true,
            curriculumUrl: true,
            city: true,
            stateProvince: true,
            dateOfBirth: true,
          },
        },
      },
    }),
    // Pull the most recent instructor application so we can prefill the standard
    // profile info we already collected — instructors only fill the gaps.
    prisma.instructorApplication
      .findFirst({
        where: { applicantId: session.user.id },
        orderBy: { createdAt: "desc" },
        select: {
          schoolName: true,
          subjectsOfInterest: true,
          city: true,
          stateProvince: true,
          dateOfBirth: true,
        },
      })
      .catch(() => null),
    getInstructorJourney(session.user.id),
    // Training is now an in-context phase of the launchpad, so the launchpad
    // owns the same mission-control view model the standalone page renders.
    getTrainingHomeModel(session.user.id),
  ]);

  // Merge: prefer what the instructor already has on their profile, and fall
  // back to the application for any standard field we didn't capture there yet.
  const profile = user?.profile ?? null;
  const applicationSubjects = application?.subjectsOfInterest
    ? application.subjectsOfInterest
        .split(",")
        .map((subject) => subject.trim())
        .filter(Boolean)
    : [];
  const profileData = {
    bio: profile?.bio ?? null,
    curriculumUrl: profile?.curriculumUrl ?? null,
    interests:
      profile?.interests && profile.interests.length > 0
        ? profile.interests
        : applicationSubjects,
    school: profile?.school ?? application?.schoolName ?? null,
    city: profile?.city ?? application?.city ?? null,
    stateProvince: profile?.stateProvince ?? application?.stateProvince ?? null,
    dateOfBirth: profile?.dateOfBirth ?? application?.dateOfBirth ?? null,
  };

  return (
    <InstructorLaunchpad
      userName={user?.name ?? ""}
      profileData={profileData}
      initialJourney={journey}
      trainingModel={training.model}
    />
  );
}
