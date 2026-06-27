import { redirect } from "next/navigation";

import { PageHeaderV2, EmptyStateV2, ButtonLink, StatusBadge } from "@/components/ui-v2";
import { getChapterViewerContext, requireChapterManager } from "@/lib/chapters/access";
import { loadOperatingHub } from "@/lib/chapters/operating-rooms-loader";
import { chapterLifecycleTone } from "@/lib/chapters/lifecycle";
import { OperatingHubView } from "@/components/chapters/operating-hub";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operating System — Pathways Portal" };

// The Organizational Operating System hub — the "building" a Chapter President
// walks into. Six permanent operating domains (Partner Network, Teaching
// Organization, Learning Program, Live Classes, Student Community, Chapter
// Growth), each its own room. Everything is computed from real data; each room
// shows its health, what needs you, and the next action.
export default async function ChapterOperatingPage() {
  const ctx = await getChapterViewerContext();

  if (!ctx.ledChapterId && ctx.isLeadership) {
    redirect("/admin/chapters");
  }
  if (!ctx.ledChapterId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <PageHeaderV2
          eyebrow="Operating System"
          title="Run your chapter like a real organization"
          subtitle="Six operating domains — partners, teaching, curriculum, classes, students, and growth — in one place."
        />
        <div className="mt-8">
          <EmptyStateV2
            title="You don't lead a chapter yet"
            body="Once your Chapter President application is approved, your operating system opens here: six rooms that together run the chapter."
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

  await requireChapterManager(ctx.ledChapterId);

  const hub = await loadOperatingHub(ctx.ledChapterId);
  if (!hub) redirect("/chapter");

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeaderV2
        eyebrow="Operating System"
        title={hub.chapter.name}
        subtitle="Six operating domains that together run your chapter. Enter a room to see its health, what needs you, and what to do next."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={chapterLifecycleTone(hub.chapter.lifecycleStatus)}>
              {hub.chapter.lifecycleLabel}
            </StatusBadge>
            <ButtonLink href="/chapter" variant="secondary" size="sm">
              Chapter home
            </ButtonLink>
          </div>
        }
      />
      <div className="mt-6">
        <OperatingHubView hub={hub} />
      </div>
    </div>
  );
}
