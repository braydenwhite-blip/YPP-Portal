import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getGRTemplates } from "@/lib/gr-actions";
import GRTemplateListPanel from "@/components/gr/gr-template-list-panel";

export const metadata = { title: "G&R Templates — Admin" };

export default async function GRTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes("ADMIN")) redirect("/");

  const templates = await getGRTemplates();

  const serialized = templates.map((t) => ({
    id: t.id,
    title: t.title,
    roleType: t.roleType,
    officerPosition: t.officerPosition,
    status: t.status,
    version: t.version,
    publishedAt: t.publishedAt?.toISOString() ?? null,
    goalCount: t.goals.length,
    assignmentCount: t._count.assignments,
    commentCount: t._count.comments,
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">G&R Templates</h1>
          <p className="page-subtitle">
            Create and manage Goals &amp; Responsibilities templates for each mentee role
          </p>
        </div>
      </div>

      <GRTemplateListPanel templates={serialized} />
    </div>
  );
}
