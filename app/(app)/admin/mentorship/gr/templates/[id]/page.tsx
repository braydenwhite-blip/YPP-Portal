import Link from "next/link";
import { notFound } from "next/navigation";

import GRTemplateEditor from "@/components/gr/gr-template-editor";
import { getGRTemplateDetail } from "@/lib/gr-actions";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export const metadata = {
  title: "Edit G&R template",
};

export default async function AdminGRTemplateDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  if (!id) {
    notFound();
  }

  const dbTemplate = await getGRTemplateDetail(id);

  if (!dbTemplate) {
    notFound();
  }

  const template = {
    id: dbTemplate.id,
    title: dbTemplate.title,
    roleType: dbTemplate.roleType,
    officerPosition: dbTemplate.officerPosition,
    roleMission: dbTemplate.roleMission,
    version: dbTemplate.version,
    status: dbTemplate.status,
    goals: (dbTemplate.goals ?? []).map((g: {
      id: string;
      title: string;
      description: string;
      timePhase: string;
      sortOrder: number;
    }) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      timePhase: g.timePhase,
      sortOrder: g.sortOrder,
    })),
    successCriteria: (dbTemplate.successCriteria ?? []).map((sc: {
      id: string;
      timePhase: string;
      criteria: string;
    }) => ({
      id: sc.id,
      timePhase: sc.timePhase,
      criteria: sc.criteria,
    })),
    comments: (dbTemplate.comments ?? []).map((c: {
      id: string;
      body: string;
      createdAt: Date;
      author?: { name?: string | null; email?: string | null } | null;
    }) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
      author: {
        name: c.author?.name ?? "Someone",
        email: c.author?.email ?? "",
      },
    })),
    resources: (dbTemplate.resources ?? []).map((r: {
      id: string;
      resource?: { title: string; url: string } | null;
    }) => ({
      id: r.id,
      resource: r.resource
        ? {
            title: r.resource.title,
            url: r.resource.url,
          }
        : null,
    })),
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <Link
          href="/mentorship?view=admin"
          className="text-[13px] font-medium text-brand-700 no-underline hover:underline"
        >
          ← G&R templates
        </Link>
        <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.3px] text-ink">
          Edit template
        </h1>
        <p className="m-0 mt-1 text-[14px] text-ink-muted">
          Update the goals that get copied when this template is assigned.
        </p>
      </div>

      <GRTemplateEditor template={template} />
    </div>
  );
}
