import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { loadChapterMap } from "@/lib/chapters/leadership";
import { PageHeaderV2, CardV2, StatusBadge, EmptyStateV2, ButtonLink } from "@/components/ui-v2";
import { chapterLifecycleLabel, chapterLifecycleTone } from "@/lib/chapters/lifecycle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter Map — Pathways Portal" };

export default async function ChapterMapPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("STAFF")) redirect("/");

  const { chapters, stateRows, totals, expansionGaps } = await loadChapterMap();
  const maxChapters = Math.max(1, ...stateRows.map((r) => r.chapters + r.openApplicants));

  const tiles = [
    { label: "Active chapters", value: totals.active },
    { label: "Launching", value: totals.launching },
    { label: "States represented", value: totals.statesRepresented },
    { label: "Schools represented", value: totals.schoolsRepresented },
    { label: "Open applicants", value: totals.openApplicants },
    { label: "Total chapters", value: totals.chapters },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeaderV2
        eyebrow="Leadership"
        title="National Chapter Map"
        subtitle="Where chapters exist, where they're launching, where applicants are concentrated, and where the gaps are."
        actions={<ButtonLink href="/admin/chapters" variant="secondary" size="sm">Chapter command</ButtonLink>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-line bg-surface px-3 py-2.5 shadow-card">
            <div className="text-[22px] font-bold text-ink">{t.value}</div>
            <div className="text-[12px] text-ink-muted">{t.label}</div>
          </div>
        ))}
      </div>

      <CardV2 padding="md" className="flex flex-col gap-3">
        <h2 className="text-[15px] font-bold text-ink">Chapter density by state</h2>
        {stateRows.length === 0 ? (
          <p className="text-[13px] text-ink-muted">No chapters or applicants yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {stateRows.map((r) => {
              const total = r.chapters + r.openApplicants;
              const pct = (n: number) => `${Math.round((n / maxChapters) * 100)}%`;
              return (
                <div key={r.state} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 truncate text-[13px] font-medium text-ink" title={r.state}>
                    {r.state}
                  </div>
                  <div className="flex h-5 flex-1 overflow-hidden rounded-full bg-idle-50" title={`${total} total`}>
                    {r.active > 0 && <div className="h-full bg-complete-700" style={{ width: pct(r.active) }} />}
                    {r.launching > 0 && <div className="h-full bg-brand-500" style={{ width: pct(r.launching) }} />}
                    {r.prospect > 0 && <div className="h-full bg-progress-700/70" style={{ width: pct(r.prospect) }} />}
                    {r.openApplicants > 0 && <div className="h-full bg-info-700/60" style={{ width: pct(r.openApplicants) }} />}
                  </div>
                  <div className="w-44 shrink-0 text-right text-[11.5px] text-ink-muted">
                    {r.active}A · {r.launching}L · {r.prospect}P · {r.openApplicants} appl
                  </div>
                </div>
              );
            })}
            <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-ink-muted">
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-complete-700" /> Active</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-500" /> Launching</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-progress-700/70" /> Prospect</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-info-700/60" /> Open applicants</span>
            </div>
          </div>
        )}
      </CardV2>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CardV2 padding="md" className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold text-ink">Growth opportunities</h2>
          {expansionGaps.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No clear gaps — applicant demand currently maps to existing chapters.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {expansionGaps.map((g) => (
                <li key={g.state} className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-ink">{g.state}</span>
                  <span className="text-ink-muted">{g.openApplicants} applicant{g.openApplicants === 1 ? "" : "s"}, no chapter yet</span>
                </li>
              ))}
            </ul>
          )}
        </CardV2>

        <CardV2 padding="md" className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold text-ink">Chapters</h2>
          {chapters.length === 0 ? (
            <EmptyStateV2 title="No chapters yet" body="Approved applications create chapters automatically." />
          ) : (
            <ul className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto">
              {chapters.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <Link href={`/admin/chapters/${c.id}`} className="min-w-0 flex-1 truncate font-medium text-brand-800 hover:underline">
                    {c.name}
                  </Link>
                  <span className="shrink-0 text-[11.5px] text-ink-muted">
                    {[c.city, c.state].filter(Boolean).join(", ")}
                  </span>
                  <StatusBadge tone={chapterLifecycleTone(c.lifecycleStatus)}>
                    {chapterLifecycleLabel(c.lifecycleStatus)}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </CardV2>
      </div>
    </div>
  );
}
