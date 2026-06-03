import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import OnboardingWizard from "@/components/onboarding/onboarding-wizard";
import { normalizeRoleList } from "@/lib/authorization";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch user WITHOUT the onboarding relation (in case table doesn't exist)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    // Explicit select keeps onboarding working even if the database
    // hasn't been migrated yet (e.g. xp/level columns missing).
    select: {
      id: true,
      name: true,
      primaryRole: true,
      roles: { select: { role: true } },
      chapter: { select: { id: true, name: true } },
      profile: {
        select: {
          bio: true,
          school: true,
          grade: true,
          interests: true,
          parentEmail: true,
          parentPhone: true,
          dateOfBirth: true,
          learningStyle: true,
          primaryGoal: true,
          curriculumUrl: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  // Try to fetch onboarding progress separately (table may not exist)
  let onboardingData: { currentStep: number; completedAt: Date | null } | null = null;
  try {
    onboardingData = await prisma.onboardingProgress.findUnique({
      where: { userId: session.user.id },
      select: { currentStep: true, completedAt: true },
    });
  } catch {
    // Table doesn't exist yet — start fresh
  }

  // If onboarding is already completed, redirect to dashboard
  if (onboardingData?.completedAt) {
    redirect("/");
  }

  const roles = normalizeRoleList(user.roles, user.primaryRole);

  // Instructors now onboard through the unified Instructor Launchpad. Keep this
  // redirect so old /onboarding bookmarks (and the app-shell gate) land them on
  // the new 4-step experience instead of the retired instructor wizard.
  if (roles.includes("INSTRUCTOR")) {
    redirect("/instructor-onboarding");
  }

  return (
    <OnboardingWizard
      userName={user.name}
      chapterName={user.chapter?.name}
      initialStep={onboardingData?.currentStep ?? 0}
      profileData={user.profile ? {
        bio: user.profile.bio,
        school: user.profile.school,
        grade: user.profile.grade,
        interests: user.profile.interests,
        parentEmail: user.profile.parentEmail,
        parentPhone: user.profile.parentPhone,
        dateOfBirth: user.profile.dateOfBirth,
        learningStyle: user.profile.learningStyle,
        primaryGoal: user.profile.primaryGoal,
        curriculumUrl: user.profile.curriculumUrl,
      } : null}
    />
  );
}
