import { redirect } from "next/navigation";

import { PageHeaderV2, EmptyStateV2, ButtonLink, StatusBadge } from "@/components/ui-v2";
import { getChapterViewerContext, requireChapterManager } from "@/lib/chapters/access";
import { loadChapterOperatingSystem } from "@/lib/chapters/operating-system";
import { chapterLifecycleTone } from "@/lib/chapters/lifecycle";
import { ChapterOperatingSystemView } from "@/components/chapters/chapter-operating-system";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter Operating System — Pathways Portal" };

// The deep pipeline surface that runs Weeks 1–10 of the Chapter President
// playbook: the four lanes, per-class launch readiness, and impact-meeting prep,
// all computed from real data. The calm `/chapter` home links here for the work;
// this is where a CP actually moves the chapter forward.
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

  const os = await loadChapterOperatingSystem(ctx.ledChapterId);
  if (!os) redirect("/chapter");

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeaderV2
        eyebrow={`Week ${os.weekNumber} · ${os.impact.focus}`}
        title="Chapter Operating System"
        subtitle="What needs you across partners, instructors, curriculum, and classes — plus this week's impact-meeting prep."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={chapterLifecycleTone(os.chapter.lifecycleStatus)}>
              {os.chapter.lifecycleLabel}
            </StatusBadge>
            <ButtonLink href="/chapter" variant="secondary" size="sm">
              Chapter home
            </ButtonLink>
          </div>
        }
      />
      <div className="mt-6">
        <ChapterOperatingSystemView os={os} />
      </div>
    </div>
  );
}
