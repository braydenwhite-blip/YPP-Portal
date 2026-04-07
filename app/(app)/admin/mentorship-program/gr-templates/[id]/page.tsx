import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getGRTemplateDetail } from "@/lib/gr-actions";
import GRTemplateEditor from "@/components/gr/gr-template-editor";

export const metadata = { title: "Edit G&R Template — Admin" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GRTemplateDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.roles?.includes("ADMIN")) redirect("/");

  const template = await getGRTemplateDetail(id);

  const serialized = {
    id: template.id,
    title: template.title,
    roleType: template.roleType,
    officerPosition: template.officerPosition,
    roleMission: template.roleMission,
    status: template.status,
    version: template.version,
    publishedAt: template.publishedAt?.toISOString() ?? null,
    isActive: template.isActive,
    createdBy: template.createdBy?.name ?? "Unknown",
    lastEditedBy: template.lastEditedBy?.name ?? null,
    assignmentCount: template._count.assignments,
    goals: template.goals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      timePhase: g.timePhase,
      sortOrder: g.sortOrder,
      kpiDefinitions: g.kpiDefinitions.map((k) => ({
        id: k.id,
        label: k.label,
        sourceType: k.sourceType,
        targetValue: k.targetValue,
        unit: k.unit,
      })),
    })),
    successCriteria: template.successCriteria.map((sc) => ({
      id: sc.id,
      timePhase: sc.timePhase,
      criteria: sc.criteria,
    })),
    resources: template.resources.map((r) => ({
      id: r.id,
      resourceId: r.resourceId,
      title: r.resource.title,
      url: r.resource.url,
      sortOrder: r.sortOrder,
    })),
    comments: template.comments.map((c) => ({
      id: c.id,
      body: c.body,
      authorName: c.author.name,
      createdAt: c.createdAt.toISOString(),
    })),
    versions: template.versions.map((v) => ({
      version: v.version,
      changeNote: v.changeNote,
      createdAt: v.createdAt.toISOString(),
    })),
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin / G&R Templates</p>
          <h1 className="page-title">{template.title}</h1>
          <p className="page-subtitle">
            {template.roleType} template — v{template.version}
          </p>
        </div>
      </div>

      <GRTemplateEditor template={serialized} />
    </div>
  );
}
