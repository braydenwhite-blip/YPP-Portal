import { redirect } from "next/navigation";

import { PageHeaderV2, EmptyStateV2, ButtonLink, StatusBadge } from "@/components/ui-v2";
import { getChapterViewerContext, requireChapterManager } from "@/lib/chapters/access";
import { loadOrganizationGraph } from "@/lib/organization/graph-loader";
import { toGraphViewModel } from "@/lib/organization/view-model";
import { OrganizationGraphInspector } from "@/components/chapters/organization-graph";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organization Graph — Pathways Portal" };

// The living model of the chapter. Every partner, curriculum, instructor, class,
// student, and family rendered as one connected graph: pick any entity and see
// why it exists, what depends on it, what it enables, what's blocking it, what it
// would unblock, its health, recent changes, and the recommended next move — all
// derived from existing operating data, no parallel model.
export default async function ChapterOrganizationPage() {
  const ctx = await getChapterViewerContext();

  if (!ctx.ledChapterId && ctx.isLeadership) {
    redirect("/admin/chapters");
  }
  if (!ctx.ledChapterId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <PageHeaderV2
          eyebrow="Chapter"
          title="Organization Graph"
          subtitle="See your whole chapter as one connected model — every partner, class, instructor, and student."
        />
        <div className="mt-8">
          <EmptyStateV2
            title="You don't lead a chapter yet"
            body="Once your Chapter President application is approved, your chapter's organization graph — every relationship, dependency, and recommendation — appears here."
            action={
              <ButtonLink href="/chapter/apply" variant="primary">
                Apply to start a chapter
              </ButtonLink>
            }
          />
        </div>
      </div>
    );
  }

  // Authorize: the Chapter President of this chapter (or national leadership).
  await requireChapterManager(ctx.ledChapterId);

  const graph = await loadOrganizationGraph(ctx.ledChapterId);
  if (!graph) redirect("/chapter");

  const model = toGraphViewModel(graph);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeaderV2
        eyebrow={`${model.chapter.name}${model.chapter.location ? ` · ${model.chapter.location}` : ""}`}
        title="Organization Graph"
        subtitle="Your whole chapter as one connected model. Select any entity to see what it depends on, what it enables, what's blocked, and what should happen next."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={model.chapter.health.tone}>{model.chapter.health.label}</StatusBadge>
            <ButtonLink href="/chapter/operating" variant="secondary" size="sm">
              Operating rooms
            </ButtonLink>
          </div>
        }
      />
      <div className="mt-6">
        <OrganizationGraphInspector model={model} />
      </div>
    </div>
  );
}
