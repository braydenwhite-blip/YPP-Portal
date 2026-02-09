import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const learningGoalsStr = formData.get("learningGoals") as string;
  const availableHours = formData.get("availableHours") as string;
  const preferredLearningStyle = formData.get("preferredLearningStyle") as string;

  const learningGoals = learningGoalsStr ? JSON.parse(learningGoalsStr) : [];

  // Create or update onboarding record
  await prisma.studentOnboarding.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      completedIntro: true,
      completedPassionQuiz: false,
      completedProfileSetup: true,
      completedFirstTryIt: false,
      completedFirstPractice: false,
      learningGoals,
      availableHours: availableHours ? parseInt(availableHours) : null,
      preferredLearningStyle: preferredLearningStyle || null,
      completedAt: new Date(),
      currentStep: "completed"
    },
    update: {
      learningGoals,
      availableHours: availableHours ? parseInt(availableHours) : null,
      preferredLearningStyle: preferredLearningStyle || null,
      completedAt: new Date(),
      currentStep: "completed"
    }
  });

  // Create default personalization settings
  await prisma.personalizationSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id
    },
    update: {}
  });

  redirect("/home");
}
