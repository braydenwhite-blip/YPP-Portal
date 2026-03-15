import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getInstructorCompetitionDrafts,
  getCompetitionById,
} from "@/lib/competition-draft-actions";
import { getActivePassionAreas } from "@/lib/passion-lab-actions";
import { prisma } from "@/lib/prisma";
import { CompetitionBuilderClient } from "./client";
import {
  hasCompetitionDraftOwnership,
  hasCompetitionPlanningDetails,
} from "@/lib/schema-compat";
import { normalizeCompetitionPlanningDetails } from "@/lib/instructor-builder-blueprints";

export default async function CompetitionBuilderPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
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

  // Fetch instructor's chapter from DB (chapterId is not in session type)
  const instructor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { chapterId: true },
  });
  const hasDraftBuilderSupport = await hasCompetitionDraftOwnership();
  const hasPlanningDetailsSupport = await hasCompetitionPlanningDetails();

  const [drafts, passionAreas, chapterUsers] = await Promise.all([
    hasDraftBuilderSupport
      ? getInstructorCompetitionDrafts()
      : Promise.resolve([]),
    getActivePassionAreas(),
    instructor?.chapterId
      ? prisma.user.findMany({
          where: {
            chapterId: instructor.chapterId,
            primaryRole: {
              in: ["INSTRUCTOR", "ADMIN", "STAFF", "CHAPTER_LEAD"],
            },
          },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // Load existing competition for edit mode
  let editData = null;
  if (searchParams.id) {
    try {
      const comp = await getCompetitionById(searchParams.id);
      editData = {
        id: comp.id,
        season: comp.season,
        theme: comp.theme,
        passionArea: comp.passionArea ?? "",
        rules: comp.rules,
        startDate: comp.startDate
          ? new Date(comp.startDate).toISOString().split("T")[0]
          : "",
        endDate: comp.endDate
          ? new Date(comp.endDate).toISOString().split("T")[0]
          : "",
        submissionDeadline: comp.submissionDeadline
          ? new Date(comp.submissionDeadline).toISOString().split("T")[0]
          : "",
        votingEnabled: comp.votingEnabled,
        communityVoteWeight: comp.communityVoteWeight ?? 0.3,
        firstPlaceReward: comp.firstPlaceReward ?? "",
        secondPlaceReward: comp.secondPlaceReward ?? "",
        thirdPlaceReward: comp.thirdPlaceReward ?? "",
        judgingCriteria: Array.isArray(comp.judgingCriteria)
          ? (comp.judgingCriteria as Array<{
              name: string;
              weight: number;
              description: string;
            }>)
          : [],
        judgeIds: comp.judges?.map((j: { id: string }) => j.id) ?? [],
        planningDetails: normalizeCompetitionPlanningDetails(
          comp.planningDetails
        ),
        status: comp.status,
        reviewNotes: (comp as Record<string, unknown>).reviewNotes as
          | string
          | null,
        reviewerName: comp.reviewedBy?.name ?? null,
      };
    } catch {
      // If we can't load the competition, just show the empty builder
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {!hasDraftBuilderSupport && (
        <div
          className="card"
          style={{
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            color: "#92400e",
          }}
        >
          Competition drafts are turned off on this deployment until the latest
          competition database migration is applied.
        </div>
      )}

      <CompetitionBuilderClient
        existingDrafts={drafts}
        passionAreas={passionAreas}
        chapterUsers={chapterUsers}
        isDraftBuilderAvailable={hasDraftBuilderSupport}
        isPlanningDetailsAvailable={hasPlanningDetailsSupport}
        editData={editData ? JSON.parse(JSON.stringify(editData)) : null}
      />
    </div>
  );
}
