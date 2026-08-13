import { redirect } from "next/navigation";

import { ChapterAnalyticsLeaderboard } from "@/components/chapter/analytics/chapter-analytics-leaderboard";
import { ChapterAnalyticsOverview } from "@/components/chapter/analytics/chapter-analytics-overview";
import { EmptyStateV2, ButtonLink, PageHeaderV2 } from "@/components/ui-v2";
import {
  loadChapterAnalyticsLeaderboard,
  loadChapterAnalyticsOverview,
} from "@/lib/chapters/analytics-loader";
import type { AnalyticsRangeMonths } from "@/lib/chapters/analytics-types";
import { getChapterViewerContext, requireChapterManager } from "@/lib/chapters/access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter Analytics — Pathways Portal" };

function parseRange(raw: string | undefined): AnalyticsRangeMonths {
  if (raw === "3" || raw === "12") return Number(raw) as AnalyticsRangeMonths;
  return 6;
}

function parseView(raw: string | undefined): "overview" | "leaderboard" {
  return raw === "leaderboard" ? "leaderboard" : "overview";
}

function buildImpactHref(opts: {
  view?: "overview" | "leaderboard";
  chapterId?: string | null;
  range?: number;
  includeChapter: boolean;
}): string {
  const p = new URLSearchParams();
  if (opts.view === "leaderboard") p.set("view", "leaderboard");
  if (opts.range && opts.range !== 6) p.set("range", String(opts.range));
  if (opts.includeChapter && opts.chapterId) p.set("chapter", opts.chapterId);
  const s = p.toString();
  return s ? `/chapter/impact?${s}` : "/chapter/impact";
}

export default async function ChapterImpactPage({
  searchParams,
}: {
  searchParams?: Promise<{
    chapter?: string;
    view?: string;
    range?: string;
  }>;
}) {
  const ctx = await getChapterViewerContext();
  const sp = (await searchParams) ?? {};
  const view = parseView(sp.view);
  const range = parseRange(sp.range);

  const chapterId = ctx.isLeadership && sp.chapter ? sp.chapter : ctx.ledChapterId;

  if (!chapterId && ctx.isLeadership) {
    redirect("/admin/chapters");
  }

  if (!chapterId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <PageHeaderV2
          eyebrow="Chapter"
          title="Chapter Analytics"
          subtitle="Month-adjusted pace vs expectations for your chapter and the network."
        />
        <div className="mt-8">
          <EmptyStateV2
            title="You don't lead a chapter yet"
            body="Once your Chapter President application is approved, analytics for your chapter appear here."
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

  const leaderboardHref = buildImpactHref({
    view: "leaderboard",
    chapterId,
    range,
    includeChapter: ctx.isLeadership,
  });
  const overviewHref = buildImpactHref({
    chapterId,
    range,
    includeChapter: ctx.isLeadership,
  });

  if (view === "leaderboard") {
    const model = await loadChapterAnalyticsLeaderboard({ focusChapterId: chapterId });
    const leaderboardClient = JSON.parse(JSON.stringify(model)) as typeof model;
    return (
      <div className="mx-auto w-full max-w-none px-3 py-4 sm:px-4 lg:px-5">
        <ChapterAnalyticsLeaderboard
          model={leaderboardClient}
          focusChapterId={chapterId}
          overviewHref={overviewHref}
        />
      </div>
    );
  }

  const overview = await loadChapterAnalyticsOverview(chapterId, { rangeMonths: range });
  if (!overview) redirect(ctx.isLeadership ? "/admin/chapters" : "/chapter");

  if (!ctx.isLeadership) {
    overview.chapters = [{ id: overview.chapterId, name: overview.chapterName }];
  }

  // Ensure the client boundary only receives plain JSON (no accidental functions).
  const overviewClient = JSON.parse(JSON.stringify(overview)) as typeof overview;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">
      <ChapterAnalyticsOverview
        model={overviewClient}
        includeChapterInQuery={ctx.isLeadership}
        leaderboardHref={leaderboardHref}
      />
    </div>
  );
}
