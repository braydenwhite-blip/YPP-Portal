import { ButtonLink } from "@/components/ui-v2";
import { loadPublicChapterStats } from "@/lib/chapters/public";

// "Become a Chapter President" opportunity hero with live network stats. Async
// server component — drop it in above the application form.
export async function ChapterOpportunity({ showApply = true }: { showApply?: boolean }) {
  const stats = await loadPublicChapterStats();

  const tiles = [
    { label: "Active chapters", value: stats.activeChapters },
    { label: "States represented", value: stats.statesRepresented },
    { label: "Students impacted", value: stats.studentsImpacted },
    { label: "Applications in progress", value: stats.applicationsInProgress },
  ];

  const points = [
    { h: "What a chapter is", b: "A student-led YPP community at your school that runs classes, workshops, and events." },
    { h: "Why start one", b: "Bring YPP's programs to your community and lead a real team toward real impact." },
    { h: "Expected impact", b: "Reach dozens of students with hands-on learning in your first year." },
    { h: "Time commitment", b: "A few hours a week — recruiting, planning meetings, and running programs." },
    { h: "Benefits", b: "Founder-level leadership experience, mentorship from national, and a launch playbook." },
  ];

  return (
    <section className="overflow-hidden rounded-[18px] border border-brand-200 bg-gradient-to-br from-brand-50 to-surface p-6 shadow-card">
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-brand-700">Opportunity</p>
      <h2 className="mt-1 text-[26px] font-bold leading-tight text-brand-900">Become a Chapter President</h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-snug text-ink">
        Start and lead a YPP chapter at your school. You bring the energy; we bring the playbook, the
        training, and a national team behind you.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-brand-100 bg-surface px-3 py-2.5">
            <div className="text-[24px] font-bold text-brand-800">{t.value}</div>
            <div className="text-[12px] text-ink-muted">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {points.map((p) => (
          <div key={p.h} className="rounded-xl bg-surface/70 p-3">
            <p className="text-[13px] font-semibold text-ink">{p.h}</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{p.b}</p>
          </div>
        ))}
      </div>

      {showApply && (
        <div className="mt-5">
          <ButtonLink href="/chapter/apply" variant="primary">
            Apply to become a Chapter President
          </ButtonLink>
        </div>
      )}
    </section>
  );
}
