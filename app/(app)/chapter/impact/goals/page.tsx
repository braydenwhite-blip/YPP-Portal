import Link from "next/link";

import { ChapterAnalyticsGoalsSettings } from "@/components/chapter/analytics/chapter-analytics-goals-settings";
import { PageHeaderV2, EmptyStateV2 } from "@/components/ui-v2";
import { requireChapterLeadership } from "@/lib/chapters/access";
import { loadGoalsSettings } from "@/lib/chapters/analytics-goals";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter Analytics Goals — Pathways Portal" };

export default async function ChapterAnalyticsGoalsPage() {
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
          title="Analytics Goals"
          subtitle="Set network-wide and per-chapter targets for Chapter Analytics."
        />
        <div className="mt-8">
          <EmptyStateV2
            title="Leadership only"
            body="Goal targets are set by national leadership. Your chapter's expectations still update automatically on the Analytics page."
            action={
              <Link href="/chapter/impact" className="text-[13px] font-semibold text-[#6b21c8]">
                Back to Analytics
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const model = await loadGoalsSettings();
  const modelClient = JSON.parse(JSON.stringify(model)) as typeof model;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="mb-4">
        <Link
          href="/admin/chapters"
          className="text-[12.5px] font-semibold text-brand-700 no-underline hover:underline"
        >
          ← Chapter Command
        </Link>
      </div>
      <ChapterAnalyticsGoalsSettings model={modelClient} />
    </div>
  );
}
