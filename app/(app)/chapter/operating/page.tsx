import { redirect } from "next/navigation";

import { PageHeaderV2, EmptyStateV2, ButtonLink, StatusBadge } from "@/components/ui-v2";
import { getChapterViewerContext, requireChapterManager } from "@/lib/chapters/access";
import { loadChapterOS } from "@/lib/chapters/chapter-os";
import { chapterLifecycleTone } from "@/lib/chapters/lifecycle";
import { ChapterOSRooms } from "@/components/chapters/chapter-os-rooms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter Operating System — Pathways Portal" };

// The six-room Chapter Operating System: Partner Network, Teaching Organization,
// Learning Program, Live Classes, Student Community, and Chapter Growth — each
// an evidence-backed operating room with a status, Needs You, a compact evidence
// table, and one recommended next action. All computed from real data. The calm
// `/chapter` home links here; this is where a CP actually runs the chapter.
export default async function ChapterOperatingPage() {
  const ctx = await getChapterViewerContext();

  if (!ctx.ledChapterId && ctx.isLeadership) {
    redirect("/admin/chapters");
  }
  if (!ctx.ledChapterId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <PageHeaderV2
          eyebrow="Chapter"
          title="Chapter Operating System"
          subtitle="Run your chapter's full pipeline from one place."
        />
        <div className="mt-8">
          <EmptyStateV2
            title="You don't lead a chapter yet"
            body="Once your Chapter President application is approved, your operating system — partners, instructors, curriculum, classes, launch readiness, and impact-meeting prep — appears here."
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

  const model = await loadChapterOS(ctx.ledChapterId);
  if (!model) redirect("/chapter");

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeaderV2
        eyebrow={`Week ${model.weekNumber} · ${model.focus}`}
        title="Chapter Operating System"
        subtitle="Six operating rooms — partners, instructors, curriculum, classes, students, and growth — each backed by real evidence."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={chapterLifecycleTone(model.chapter.lifecycleStatus)}>
              {model.chapter.lifecycleLabel}
            </StatusBadge>
            <ButtonLink href="/chapter" variant="secondary" size="sm">
              Chapter home
            </ButtonLink>
          </div>
        }
      />
      <div className="mt-6">
        <ChapterOSRooms model={model} />
      </div>
    </div>
  );
}
