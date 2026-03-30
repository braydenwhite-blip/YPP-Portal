import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getInstructorSequences,
  getSequenceById,
} from "@/lib/sequence-actions";
import { getInstructorPassionLabs } from "@/lib/passion-lab-actions";
import { prisma } from "@/lib/prisma";
import { SequenceBuilderClient } from "./client";
import { getClassTemplateCapabilities } from "@/lib/class-template-compat";
import { getInstructorReadiness } from "@/lib/instructor-readiness";

export default async function SequenceBuilderPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (
    !roles.includes("ADMIN") &&
    !roles.includes("INSTRUCTOR") &&
    !roles.includes("CHAPTER_PRESIDENT")
  ) {
    redirect("/dashboard");
  }

  const capabilities = await getClassTemplateCapabilities();

  const [sequences, passionLabs, approvedTemplates, readiness] =
    await Promise.all([
      getInstructorSequences(),
      getInstructorPassionLabs(),
      prisma.classTemplate.findMany({
        where: {
          createdById: session.user.id,
          ...(capabilities.hasReviewWorkflow
            ? { submissionStatus: "APPROVED" as const }
            : { isPublished: true }),
        },
        select: {
          id: true,
          title: true,
          interestArea: true,
          difficultyLevel: true,
        },
        orderBy: { title: "asc" },
      }),
      getInstructorReadiness(session.user.id),
    ]);

  // Load specific sequence for edit mode (used when admin clicks Edit on a sequence)
  let editSequenceId: string | null = null;
  if (searchParams.id) {
    try {
      const seq = await getSequenceById(searchParams.id);
      if (seq) editSequenceId = seq.id;
    } catch {
      // If we can't load the sequence, just show the normal builder
    }
  }

  return (
    <SequenceBuilderClient
      sequences={sequences as any}
      approvedTemplates={approvedTemplates}
      passionLabs={passionLabs}
      readiness={readiness}
      initialActiveSequenceId={editSequenceId}
    />
  );
}
