import GRTemplateListPanel from "@/components/gr/gr-template-list-panel";
import GRAssignmentsPanel from "@/components/gr/gr-assignments-panel";
import {
  getGRAssignedDocuments,
  getGRGoalChangeQueue,
  getGRTemplates,
} from "@/lib/gr-actions";
import { getAdminMentorshipCommandCenterData } from "@/lib/admin-mentorship-command-center";

import { AdminPeopleFinder, type MentorshipPersonIndexItem } from "./admin-people-finder";

async function loadTemplates() {
  const templates = (await getGRTemplates()) ?? [];
  return templates.map((t: {
    id: string;
    title: string;
    roleType: string;
    officerPosition: string | null;
    status: string;
    version: number;
    publishedAt?: Date | null;
    goals?: unknown[];
    _count?: { assignments?: number; comments?: number };
    updatedAt?: Date;
  }) => ({
    id: t.id,
    title: t.title,
    roleType: t.roleType,
    officerPosition: t.officerPosition,
    status: t.status,
    version: t.version,
    publishedAt: t.publishedAt?.toISOString() ?? null,
    goalCount: t._count?.goals ?? t.goals?.length ?? 0,
    assignmentCount: t._count?.assignments ?? 0,
    commentCount: t._count?.comments ?? 0,
    updatedAt: t.updatedAt
      ? new Date(t.updatedAt).toISOString()
      : new Date().toISOString(),
  }));
}

async function loadAssignments(templates: Awaited<ReturnType<typeof loadTemplates>>) {
  const [documents, goalChanges] = await Promise.all([
    getGRAssignedDocuments() ?? [],
    getGRGoalChangeQueue() ?? [],
  ]);

  return {
    documents: (documents ?? []).map((d: {
      id: string;
      user?: { name?: string | null; email?: string | null } | null;
      template?: { title?: string | null; roleType?: string | null } | null;
      mentorship?: { mentor?: { name?: string | null } | null } | null;
      status: string;
      goals?: unknown[];
      _count?: { goals?: number; goalChanges?: number };
      createdAt?: Date;
    }) => ({
      id: d.id,
      userName: d.user?.name ?? "Unknown",
      userEmail: d.user?.email ?? "",
      templateTitle: d.template?.title ?? "No Template",
      roleType: d.template?.roleType ?? "STUDENT",
      mentorName: d.mentorship?.mentor?.name ?? "Unassigned",
      status: d.status,
      goalCount: d.goals?.length ?? d._count?.goals ?? 0,
      pendingChanges: d._count?.goalChanges ?? 0,
      createdAt: d.createdAt
        ? new Date(d.createdAt).toISOString()
        : new Date().toISOString(),
    })),
    goalChanges: (goalChanges ?? []).map((gc: {
      id: string;
      documentId: string;
      document?: {
        user?: { name?: string | null } | null;
        template?: { title?: string | null } | null;
      } | null;
      proposedBy?: { name?: string | null } | null;
      changeType: string;
      proposedData?: unknown;
      reason: string | null;
      createdAt?: Date;
    }) => ({
      id: gc.id,
      documentId: gc.documentId,
      userName: gc.document?.user?.name ?? "Unknown",
      templateTitle: gc.document?.template?.title ?? "No Template",
      proposedByName: gc.proposedBy?.name ?? "System",
      changeType: gc.changeType,
      proposedData: (gc.proposedData as Record<string, string>) ?? {},
      reason: gc.reason,
      createdAt: gc.createdAt
        ? new Date(gc.createdAt).toISOString()
        : new Date().toISOString(),
    })),
    templateOptions: templates.map((t) => ({
      id: t.id,
      title: t.title,
      roleType: t.roleType,
      status: t.status,
    })),
  };
}

/**
 * Simple G&R templates home — list, create, assign. No oversight cockpit.
 */
export async function AdminMentorshipHome() {
  const [templates, command] = await Promise.all([
    loadTemplates(),
    getAdminMentorshipCommandCenterData(),
  ]);
  const assignments = await loadAssignments(templates);

  const peopleMap = new Map<string, MentorshipPersonIndexItem>();
  for (const mentee of command.unassignedMentees) {
    peopleMap.set(mentee.id, {
      id: mentee.id,
      name: mentee.name ?? mentee.email,
      context: (mentee.primaryRole ?? "MEMBER").replace(/_/g, " "),
      mentor: null,
      state: "Needs a mentor",
      owner: "Leadership",
      needsAttention: true,
    });
  }
  for (const circle of command.circleSummaries) {
    if (peopleMap.has(circle.menteeId)) continue;
    peopleMap.set(circle.menteeId, {
      id: circle.menteeId,
      name: circle.menteeName,
      context: circle.menteeRole.replace(/_/g, " "),
      mentor: circle.mentorName,
      state: circle.latestReviewLabel ?? "Active pairing",
      owner: circle.mentorName,
      needsAttention: false,
    });
  }
  const people = Array.from(peopleMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <section aria-labelledby="gr-templates-heading">
        <h2 id="gr-templates-heading" className="m-0 text-[16px] font-semibold text-ink">
          Templates
        </h2>
        <p className="m-0 mt-1 mb-4 text-[13px] text-ink-muted">
          Create and edit Goals &amp; Responsibilities templates by role.
        </p>
        <GRTemplateListPanel templates={templates} />
      </section>

      <section aria-labelledby="gr-assign-heading">
        <h2 id="gr-assign-heading" className="m-0 text-[16px] font-semibold text-ink">
          Assignments
        </h2>
        <p className="m-0 mt-1 mb-4 text-[13px] text-ink-muted">
          Assign a template to someone, or review pending goal changes.
        </p>
        <GRAssignmentsPanel
          documents={assignments.documents}
          goalChanges={assignments.goalChanges}
          templates={assignments.templateOptions}
        />
      </section>

      <AdminPeopleFinder people={people} />
    </div>
  );
}
