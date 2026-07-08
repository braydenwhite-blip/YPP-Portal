import { redirect } from "next/navigation";

import { PageHeaderV2, EmptyStateV2, ButtonLink, StatusBadge } from "@/components/ui-v2";
import { getChapterViewerContext, requireChapterManager } from "@/lib/chapters/access";
import { loadChapterImpactBrief } from "@/lib/chapters/impact-brief-server";
import { ImpactMeetingBrief, READINESS_TONE } from "@/components/chapters/impact-meeting-brief";
import { PrintBriefButton } from "@/components/chapters/print-brief-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Impact Meeting — Pathways Portal" };

// Impact Meeting Mode: the chapter's generated weekly brief. The chapter never
// "makes a report" — this page assembles it from the work already recorded:
// what changed, current numbers vs. expectations, lane updates, wins, open
// work, risks, support requests, decisions needed, and next-week commitments.
// A Chapter President opens it during the meeting and speaks from it; national
// leadership opens any chapter's brief via ?chapter= from Chapter Command.
export default async function ChapterImpactPage({
  searchParams,
}: {
  searchParams?: Promise<{ chapter?: string }>;
}) {
  const ctx = await getChapterViewerContext();
  const sp = (await searchParams) ?? {};

  // Leadership may open any chapter's brief via ?chapter=; a CP gets their own.
  const chapterId = ctx.isLeadership && sp.chapter ? sp.chapter : ctx.ledChapterId;

  if (!chapterId && ctx.isLeadership) {
    redirect("/admin/chapters");
  }
  if (!chapterId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <PageHeaderV2
          eyebrow="Chapter"
          title="Impact Meeting"
          subtitle="Your weekly brief, generated from the work your chapter already records."
        />
        <div className="mt-8">
          <EmptyStateV2
            title="You don't lead a chapter yet"
            body="Once your Chapter President application is approved, your weekly Impact Meeting brief appears here — numbers, changes, wins, risks, decisions, and commitments."
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

  await requireChapterManager(chapterId);

  const model = await loadChapterImpactBrief(chapterId, { isLeadership: ctx.isLeadership });
  if (!model) redirect(ctx.isLeadership ? "/admin/chapters" : "/chapter");

  const { brief } = model;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeaderV2
        eyebrow={`Week ${brief.weekNumber} · ${brief.focus} · ${brief.weekLabel}`}
        title="Impact Meeting"
        subtitle={`${brief.chapter.name} · ${brief.chapter.lifecycleLabel}${brief.chapter.presidentName ? ` · ${brief.chapter.presidentName}` : ""}`}
        backHref={ctx.isLeadership && !ctx.ledChapterId ? `/admin/chapters/${chapterId}` : "/chapter"}
        backLabel={ctx.isLeadership && !ctx.ledChapterId ? "Chapter detail" : "Chapter home"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={READINESS_TONE[brief.readiness.state]} withDot>
              {brief.readiness.label}
            </StatusBadge>
            <PrintBriefButton />
            <ButtonLink href="/chapter?lane=meetings" variant="secondary" size="sm">
              Chapter Operating System
            </ButtonLink>
          </div>
        }
      />

      <div className="mt-6">
        <ImpactMeetingBrief model={model} />
      </div>
    </div>
  );
}
