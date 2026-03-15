import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { clonePassionLab } from "@/lib/passion-lab-actions";
import { passionLabExamples } from "@/data/instructor-guide-examples";
import { prisma } from "@/lib/prisma";
import { hasPassionLabBuilderSchema } from "@/lib/schema-compat";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = session.user.roles ?? [];
    if (
      !roles.includes("ADMIN") &&
      !roles.includes("INSTRUCTOR") &&
      !roles.includes("CHAPTER_LEAD")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { templateId } = await req.json();
    if (!templateId) {
      return NextResponse.json(
        { error: "templateId is required" },
        { status: 400 }
      );
    }

    // Handle built-in examples (from instructor-guide-examples.ts)
    if (typeof templateId === "string" && templateId.startsWith("builtin-")) {
      const idx = parseInt(templateId.replace("builtin-", ""), 10);
      const example = passionLabExamples[idx];
      if (!example) {
        return NextResponse.json(
          { error: "Built-in example not found" },
          { status: 404 }
        );
      }

      const hasSupport = await hasPassionLabBuilderSchema();
      if (!hasSupport) {
        return NextResponse.json(
          { error: "Database migration required" },
          { status: 500 }
        );
      }

      const clone = await prisma.specialProgram.create({
        data: {
          name: `${example.title} (Copy)`,
          description: example.overview,
          interestArea: example.fields.interestArea.value,
          type: "PASSION_LAB",
          isVirtual: false,
          isActive: false,
          leaderId: session.user.id,
          createdById: session.user.id,
          submissionStatus: "DRAFT",
          drivingQuestion: example.fields.drivingQuestion.value,
          targetAgeGroup: example.fields.targetAgeGroup.value,
          difficulty: example.fields.difficulty.value,
          deliveryMode: example.fields.deliveryMode.value as import("@prisma/client").DeliveryMode | null | undefined,
          finalShowcase: example.fields.finalShowcase.value,
          submissionFormat: example.fields.submissionFormat.value,
          labBlueprint: {
            bigIdea: example.blueprint.bigIdea.value,
            studentChoicePlan: example.blueprint.studentChoicePlan.value,
            mentorCommunityConnection:
              example.blueprint.mentorCommunityConnection.value,
            showcaseCriteria: example.blueprint.showcaseCriteria.value,
            supportPlan: example.blueprint.supportPlan.value,
            riskSafetyNotes: example.blueprint.riskSafetyNotes.value,
            resourcePlan: example.blueprint.resourcePlan.value,
          },
          sessionTopics: example.sessions.map((s) => ({
            topic: s.topic,
            objective: s.objective,
            checkpointArtifact: s.checkpointArtifact,
          })),
        },
      });

      revalidatePath("/instructor/passion-lab-builder");
      return NextResponse.json({ programId: clone.id });
    }

    // Handle DB templates
    const result = await clonePassionLab(templateId);
    return NextResponse.json({ programId: result.programId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to clone template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
