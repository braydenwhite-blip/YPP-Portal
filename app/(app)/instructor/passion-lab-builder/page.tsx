import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getInstructorPassionLabs, getActivePassionAreas, getPassionLabById } from "@/lib/passion-lab-actions";
import { prisma } from "@/lib/prisma";
import { PassionLabBuilderClient } from "./client";
import { hasPassionLabBuilderSchema } from "@/lib/schema-compat";
import { getInstructorReadiness } from "@/lib/instructor-readiness";
import {
  normalizePassionLabBlueprint,
  normalizePassionLabSessionTopic,
} from "@/lib/instructor-builder-blueprints";

type Props = {
  searchParams: { id?: string };
};

export default async function PassionLabBuilderPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (
    !roles.includes("ADMIN") &&
    !roles.includes("INSTRUCTOR") &&
    !roles.includes("CHAPTER_LEAD")
  ) {
    redirect("/dashboard");
  }
  const hasPassionLabSupport = await hasPassionLabBuilderSchema();

  const [passionLabs, passionAreas, instructor, readiness] = await Promise.all([
    hasPassionLabSupport ? getInstructorPassionLabs() : Promise.resolve([]),
    getActivePassionAreas(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { chapterId: true } }),
    getInstructorReadiness(session.user.id),
  ]);

  if (!hasPassionLabSupport) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Passion Lab Builder</h1>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>
            Create a structured, passion-driven lab experience for students.
          </p>
        </div>

        <div
          className="card"
          style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}
        >
          Passion Lab Builder is waiting on the latest passion lab database migration for this
          deployment. Once that migration is applied, this page will load your labs and let you
          create new ones again.
        </div>
      </div>
    );
  }

  // Load existing lab data for edit mode
  let editData = null;
  if (searchParams.id) {
    const lab = await getPassionLabById(searchParams.id);
    if (lab && (lab.createdById === session.user.id || roles.includes("ADMIN"))) {
      const rawTopics = Array.isArray(lab.sessionTopics) ? lab.sessionTopics : [];
      editData = {
        id: lab.id,
        name: lab.name,
        description: lab.description ?? "",
        interestArea: lab.interestArea ?? "",
        drivingQuestion: (lab as Record<string, unknown>).drivingQuestion as string | null ?? null,
        targetAgeGroup: (lab as Record<string, unknown>).targetAgeGroup as string ?? "",
        difficulty: (lab as Record<string, unknown>).difficulty as string ?? "BEGINNER",
        deliveryMode: (lab as Record<string, unknown>).deliveryMode as string ?? "VIRTUAL",
        finalShowcase: (lab as Record<string, unknown>).finalShowcase as string | null ?? null,
        submissionFormat: (lab as Record<string, unknown>).submissionFormat as string ?? "",
        maxParticipants: lab.maxParticipants ?? 25,
        labBlueprint: normalizePassionLabBlueprint((lab as Record<string, unknown>).labBlueprint),
        sessionTopics: rawTopics.map((t: unknown) => normalizePassionLabSessionTopic(t)),
        startDate: lab.startDate ? lab.startDate.toISOString().split("T")[0] : "",
        endDate: lab.endDate ? lab.endDate.toISOString().split("T")[0] : "",
        submissionStatus: (lab as Record<string, unknown>).submissionStatus as string ?? "DRAFT",
      };
    }
  }

  return (
    <PassionLabBuilderClient
      existingLabs={passionLabs}
      passionAreas={passionAreas}
      chapterId={instructor?.chapterId ?? null}
      readiness={readiness}
      editData={editData}
    />
  );
}
