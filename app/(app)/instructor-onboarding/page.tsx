import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { getInstructorJourney } from "@/lib/instructor-journey";
import InstructorLaunchpad from "@/components/instructor-onboarding/instructor-onboarding-guide";

export const metadata: Metadata = {
  title: "Instructor Launchpad | YPP Portal",
};

export default async function InstructorOnboardingPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/instructor-onboarding");
  }

  const [user, journey] = await Promise.all([
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
          },
        },
      },
    }),
    getInstructorJourney(session.user.id),
  ]);

  return (
    <InstructorLaunchpad
      userName={user?.name ?? ""}
      profileData={user?.profile ?? null}
      initialJourney={journey}
    />
  );
}
