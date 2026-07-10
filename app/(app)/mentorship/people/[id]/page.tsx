import { notFound, redirect } from "next/navigation";

import { MentorshipWorkspaceView } from "@/components/mentorship/workspace/workspace-view";
import type { MentorshipSetupData } from "@/components/mentorship/workspace/setup-repair-panel";
import { getSessionUser } from "@/lib/auth-supabase";
import { loadMentorshipWorkspace } from "@/lib/mentorship/workspace";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mentorship Workspace" };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function committeeLaneForRole(primaryRole: string | null | undefined): string | null {
  if (primaryRole === "INSTRUCTOR") return "INSTRUCTOR";
  if (primaryRole === "CHAPTER_PRESIDENT") return "CHAPTER_PRESIDENT";
  if (primaryRole === "STUDENT" || primaryRole === "PARENT" || primaryRole === "APPLICANT") {
    return null;
  }
  return "OFFICER";
}

/** The one person-level Mentorship destination. */
export default async function MentorshipPersonPage({ params, searchParams }: PageProps) {
  const [{ id }, sp, viewer] = await Promise.all([params, searchParams, getSessionUser()]);

  if (!viewer) redirect(`/login?next=/mentorship/people/${id}`);

  const workspace = await loadMentorshipWorkspace(viewer, id);
  if (!workspace) notFound();

  const section = typeof sp.section === "string" ? sp.section : undefined;
  const panel = typeof sp.panel === "string" ? sp.panel : undefined;

  const mentorshipMeta = workspace.activeMentorshipId
    ? await prisma.mentorship.findUnique({
        where: { id: workspace.activeMentorshipId },
        select: {
          mentorId: true,
          kickoffScheduledAt: true,
          kickoffCompletedAt: true,
        },
      })
    : null;

  const canManageMentor =
    viewer.roles.some((role) => ["ADMIN", "STAFF", "CHAPTER_PRESIDENT"].includes(role)) ||
    viewer.adminSubtypes.some((subtype) =>
      ["SUPER_ADMIN", "MENTORSHIP_ADMIN", "LEADERSHIP"].includes(subtype)
    );
  const canAssignGR = viewer.roles.includes("ADMIN");
  const canAssignChair = viewer.roles.includes("ADMIN");
  let setup: MentorshipSetupData | undefined;

  if (panel === "setup") {
    const personRole = await prisma.user.findUnique({
      where: { id },
      select: { primaryRole: true },
    });
    const chairLane = committeeLaneForRole(personRole?.primaryRole);
    const [candidateUsers, workloadRows, templates, currentChair] = await Promise.all([
      canManageMentor
        ? prisma.user.findMany({
            where: { id: { not: id }, archivedAt: null },
            select: { id: true, name: true, email: true, primaryRole: true },
            orderBy: [{ name: "asc" }, { email: "asc" }],
            take: 500,
          })
        : [],
      canManageMentor
        ? prisma.mentorship.groupBy({
            by: ["mentorId"],
            where: { status: "ACTIVE" },
            _count: { id: true },
          })
        : [],
      canAssignGR
        ? prisma.gRTemplate.findMany({
            where: { status: "GR_APPROVED", isActive: true },
            select: { id: true, title: true, roleType: true },
            orderBy: { title: "asc" },
          })
        : [],
      chairLane
        ? prisma.mentorCommitteeChair.findFirst({
            where: { lane: chairLane as never, isActive: true },
            select: { user: { select: { name: true } } },
          })
        : Promise.resolve(null),
    ]);
    const workload = new Map(workloadRows.map((row) => [row.mentorId, row._count.id]));

    setup = {
      canManageMentor,
      canAssignGR,
      canAssignChair,
      activeMentorshipId: workspace.activeMentorshipId,
      currentMentorId: mentorshipMeta?.mentorId ?? null,
      candidates: candidateUsers.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        role: candidate.primaryRole,
        activeMenteeCount: workload.get(candidate.id) ?? 0,
      })),
      templates: templates.map((template) => ({
        id: template.id,
        title: template.title,
        roleType: template.roleType,
      })),
      chairLane,
      currentChairName: currentChair?.user.name ?? null,
    };
  }

  return (
    <MentorshipWorkspaceView
      workspace={workspace}
      section={section}
      panel={panel}
      setup={setup}
      kickoff={
        mentorshipMeta
          ? {
              scheduledAt: mentorshipMeta.kickoffScheduledAt,
              completedAt: mentorshipMeta.kickoffCompletedAt,
              canMarkComplete:
                mentorshipMeta.mentorId === viewer.id || viewer.roles.includes("ADMIN"),
            }
          : undefined
      }
      helpSent={sp.sent === "1"}
      sectionHref={(sectionId) =>
        `/mentorship/people/${id}?section=${encodeURIComponent(sectionId)}`
      }
    />
  );
}
