import Link from "next/link";

import { ChapterAnalyticsGoalsSettings } from "@/components/chapter/analytics/chapter-analytics-goals-settings";
import { PageHeaderV2, EmptyStateV2 } from "@/components/ui-v2";
import { requireChapterLeadership } from "@/lib/chapters/access";
import { loadGoalsSettings } from "@/lib/chapters/analytics-goals";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set Goals — Pathways Portal" };

export default async function ChapterAnalyticsGoalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ chapter?: string }>;
}) {
  let authorized = true;
  try {
    await requireChapterLeadership();
  } catch {
    authorized = false;
  }

  if (!authorized) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <PageHeaderV2
          eyebrow="Chapter"
          title="Set goals"
          subtitle="National leadership sets the numbers chapters are graded against."
        />
        <div className="mt-8">
          <EmptyStateV2
            title="Leadership only"
            body="Goal targets are set by national leadership. Your chapter’s expectations still update automatically on Analytics."
            action={
              <Link href="/chapter/impact" className="text-[13px] font-semibold text-brand-700">
                Back to Analytics
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const sp = (await searchParams) ?? {};
  const model = await loadGoalsSettings();
  const modelClient = JSON.parse(JSON.stringify(model)) as typeof model;
  const initialChapterId =
    sp.chapter && model.chapters.some((c) => c.id === sp.chapter) ? sp.chapter : undefined;

  return (
    <div className="relative min-h-full">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[340px] bg-[radial-gradient(ellipse_at_top,_rgba(107,33,200,0.09),_transparent_58%),linear-gradient(180deg,_rgba(248,250,252,0.9),_transparent)]"
      />
      <div className="relative mx-auto w-full max-w-[640px] px-6 py-9">
        <ChapterAnalyticsGoalsSettings
          model={modelClient}
          initialChapterId={initialChapterId}
        />
      </div>
    </div>
  );
}
