import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { loadChapterAnalytics } from "@/lib/chapters/leadership";
import { PageHeaderV2, CardV2, ButtonLink } from "@/components/ui-v2";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter Analytics — Pathways Portal" };

function RankedList({ title, rows, suffix }: { title: string; rows: { key: string; count: number }[]; suffix?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <CardV2 padding="md" className="flex flex-col gap-3">
      <h2 className="text-[15px] font-bold text-ink">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-muted">No data yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-3 text-[13px]">
              <span className="w-36 shrink-0 truncate text-ink" title={r.key}>
                {r.key}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-idle-50">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-ink-muted">
                {r.count}
                {suffix ?? ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CardV2>
  );
}

export default async function ChapterAnalyticsPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("STAFF")) redirect("/");

  const { totals, chaptersPerState, applicationsBySchool, applicationsByCity, recentLaunchesByState } =
    await loadChapterAnalytics();

  const tiles = [
    { label: "Applications", value: totals.applications, detail: `${totals.openApplications} in progress` },
    { label: "Active chapters", value: totals.activeChapters, detail: `${totals.launchingChapters} launching` },
    { label: "Students impacted", value: totals.studentsImpacted, detail: "across active chapters" },
    { label: "Approval rate", value: totals.approvalRate == null ? "—" : `${totals.approvalRate}%`, detail: "of decided applications" },
    { label: "Avg review time", value: totals.avgReviewDays == null ? "—" : `${totals.avgReviewDays}d`, detail: "submit → decision" },
    { label: "States with chapters", value: chaptersPerState.length, detail: "represented" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeaderV2
        eyebrow="Leadership"
        title="National Growth Analytics"
        subtitle="Answer the growth questions instantly — applications, approvals, chapters per state, and fastest-growing regions."
        actions={
          <div className="flex gap-2">
            <ButtonLink href="/admin/chapters" variant="secondary" size="sm">Chapter command</ButtonLink>
            <ButtonLink href="/admin/chapters/map" variant="secondary" size="sm">Map</ButtonLink>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-line bg-surface px-3 py-2.5 shadow-card">
            <div className="text-[22px] font-bold text-ink">{t.value}</div>
            <div className="text-[12px] font-medium text-ink">{t.label}</div>
            <div className="text-[11px] text-ink-muted">{t.detail}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RankedList title="Chapters per state" rows={chaptersPerState} />
        <RankedList title="Fastest-growing regions (90 days)" rows={recentLaunchesByState} suffix=" launched" />
        <RankedList title="Applications by school" rows={applicationsBySchool} />
        <RankedList title="Applications by city" rows={applicationsByCity} />
      </div>
    </div>
  );
}
