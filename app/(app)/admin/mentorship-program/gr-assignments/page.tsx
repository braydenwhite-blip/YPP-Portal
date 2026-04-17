import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getGRAssignedDocuments, getGRGoalChangeQueue, getGRTemplates } from "@/lib/gr-actions";
import GRAssignmentsPanel from "@/components/gr/gr-assignments-panel";

export const metadata = { title: "G&R Assignments — Admin" };

export default async function GRAssignmentsPage() {
  const session = await getSession();
  if (!session?.user?.roles?.includes("ADMIN")) redirect("/");

  const [documents, goalChanges, templates] = await Promise.all([
    getGRAssignedDocuments(),
    getGRGoalChangeQueue(),
    getGRTemplates(),
  ]);

  const serializedDocs = documents.map((d) => ({
    id: d.id,
    userName: d.user.name,
    userEmail: d.user.email,
    templateTitle: d.template.title,
    roleType: d.template.roleType,
    mentorName: d.mentorship.mentor.name,
    status: d.status,
    goalCount: d._count.goals,
    pendingChanges: d._count.goalChanges,
    createdAt: d.createdAt.toISOString(),
  }));

  const serializedChanges = goalChanges.map((gc) => ({
    id: gc.id,
    documentId: gc.documentId,
    userName: gc.document.user.name,
    templateTitle: gc.document.template.title,
    proposedByName: gc.proposedBy.name,
    changeType: gc.changeType,
    proposedData: gc.proposedData as Record<string, string>,
    reason: gc.reason,
    createdAt: gc.createdAt.toISOString(),
  }));

  const templateOptions = templates.map((t) => ({
    id: t.id,
    title: t.title,
    roleType: t.roleType,
    status: t.status,
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">G&R Assignments</h1>
          <p className="page-subtitle">
            Assign G&R documents and review goal change proposals
          </p>
        </div>
      </div>

      <GRAssignmentsPanel
        documents={serializedDocs}
        goalChanges={serializedChanges}
        templates={templateOptions}
      />
    </div>
  );
}
