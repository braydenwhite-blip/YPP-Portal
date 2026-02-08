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

  // Fetch user WITHOUT the onboarding relation (in case table doesn't exist)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      roles: true,
      chapter: true,
      profile: true,
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

  const roles = user.roles.map((r) => r.role);

  // Fetch active pathways with their steps for the pathway selection
  const pathways = await prisma.pathway.findMany({
    where: { isActive: true },
    include: {
      steps: {
        include: { course: true },
        orderBy: { stepOrder: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Fetch user's existing enrollments to know which pathways they've already picked
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id },
    select: { courseId: true },
  });
  const enrolledCourseIds = enrollments.map((e) => e.courseId);

  return (
    <OnboardingWizard
      userName={user.name}
      primaryRole={user.primaryRole}
      roles={roles}
      chapterName={user.chapter?.name}
      initialStep={onboardingData?.currentStep ?? 0}
      profileData={user.profile ? {
        bio: user.profile.bio,
        school: user.profile.school,
        grade: user.profile.grade,
        interests: user.profile.interests,
        parentEmail: user.profile.parentEmail,
        parentPhone: user.profile.parentPhone,
        curriculumUrl: user.profile.curriculumUrl,
      } : null}
      pathways={pathways.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        interestArea: p.interestArea,
        steps: p.steps.map((s) => ({
          id: s.id,
          courseId: s.courseId,
          courseTitle: s.course.title,
          courseLevel: s.course.level,
          courseFormat: s.course.format,
          stepOrder: s.stepOrder,
        })),
      }))}
      enrolledCourseIds={enrolledCourseIds}
    />
  );
}
