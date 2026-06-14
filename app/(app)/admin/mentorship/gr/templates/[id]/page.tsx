import { getGRTemplateDetail } from "@/lib/gr-actions";
import { notFound } from "next/navigation";
import GRTemplateEditor from "@/components/gr/gr-template-editor";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export const metadata = { 
  title: "Edit G&R Template Blueprint — Pathways Portal Management" 
};

export default async function AdminGRTemplateDetailPage({ params }: PageProps) {
  // 1. Resolve asynchronous navigation parameter boundaries
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  if (!id) {
    notFound();
  }

  // 2. Query relational database schemas via centralized Server Actions
  const dbTemplate = await getGRTemplateDetail(id);

  if (!dbTemplate) {
    notFound();
  }

  // 3. Normalize schema records to guarantee absolute downstream serialization safety
  const template = {
    id: dbTemplate.id,
    title: dbTemplate.title,
    roleType: dbTemplate.roleType,
    officerPosition: dbTemplate.officerPosition,
    roleMission: dbTemplate.roleMission,
    version: dbTemplate.version,
    
    // Explicitly typed parameters prevent local 'noImplicitAny' compilation deadlocks
    goals: (dbTemplate.goals ?? []).map((g: any) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      timePhase: g.timePhase,
      sortOrder: g.sortOrder,
    })),
    
    successCriteria: (dbTemplate.successCriteria ?? []).map((sc: any) => ({
      id: sc.id,
      timePhase: sc.timePhase,
      criteria: sc.criteria,
    })),
    
    comments: (dbTemplate.comments ?? []).map((c: any) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
      author: {
        name: c.author?.name ?? "System Operator",
        email: c.author?.email ?? "",
      },
    })),
    
    resources: (dbTemplate.resources ?? []).map((r: any) => ({
      id: r.id,
      resource: r.resource ? {
        title: r.resource.title,
        url: r.resource.url,
      } : null,
    })),
    
    versions: (dbTemplate.versions ?? []).map((v: any) => ({
      version: v.version,
      changeNote: v.changeNote ?? "No modification notes documented for this snapshot entry.",
      createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString(),
    })),
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-6 animate-in fade-in duration-300">
      {/* Structural Page Header Container Block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Edit G&R Template Framework
            </h1>
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-600/10">
              v{template.version}
            </span>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Configure dynamic blueprint rules, milestone checkpoints, baseline targets, and 
            collaborative peer feedback metrics inside the centralized monitoring interface.
          </p>
        </div>
      </div>

      {/* Main Form Dashboard Component Wrapper */}
      <main className="w-full rounded-xl border border-slate-200/80 bg-white shadow-sm p-6">
        <GRTemplateEditor template={template} />
      </main>

      {/* Auxiliary Metadata Tracking Footer Block */}
      <footer className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t border-slate-100 pt-6 text-xs text-slate-400">
        <p>Template ID Reference Context: <code className="font-mono bg-slate-50 px-1.5 py-0.5 rounded text-slate-600">{template.id}</code></p>
        <p>Pathways Portal Administration · Internal Core Framework Engine</p>
      </footer>
    </div>
  );
}