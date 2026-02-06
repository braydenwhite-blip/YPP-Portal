import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OnboardingWizard from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        roles: true,
        chapter: true,
        profile: true,
        onboarding: true,
      },
    });
  } catch (error) {
    // If onboarding table is not present yet, keep the app usable.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    ) {
      redirect("/");
    }
    throw error;
  }

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
