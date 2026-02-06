import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OnboardingWizard from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      roles: true,
      chapter: true,
      profile: true,
      onboarding: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  // If onboarding is already completed, redirect to dashboard
  if (user.onboarding?.completedAt) {
    redirect("/");
  }

  const roles = user.roles.map((r) => r.role);

  return (
    <OnboardingWizard
      userName={user.name}
      primaryRole={user.primaryRole}
      roles={roles}
      chapterName={user.chapter?.name}
      initialStep={user.onboarding?.currentStep ?? 0}
      profileData={user.profile ? {
        bio: user.profile.bio,
        school: user.profile.school,
        grade: user.profile.grade,
        interests: user.profile.interests,
        parentEmail: user.profile.parentEmail,
        parentPhone: user.profile.parentPhone,
        curriculumUrl: user.profile.curriculumUrl,
      } : null}
    />
  );
}
