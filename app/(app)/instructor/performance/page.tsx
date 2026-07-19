import { PageHeaderV2, CardV2, EmptyStateV2 } from "@/components/ui-v2";
import { getInstructorPerformance } from "@/lib/session8/instructor-development";
import { pretty, shortDate } from "@/lib/session8/format";

function formatRate(rate: number | null): string {
  if (rate === null) return "No past sessions yet";
  return `${Math.round(rate * 100)}%`;
}

function PerformanceTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <CardV2 padding="md">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">{label}</p>
      <p className="mt-1 text-[28px] font-bold leading-none tracking-[-0.01em] text-ink">{value}</p>
      <p className="mt-2 text-xs text-ink-muted">{detail}</p>
    </CardV2>
  );
}

export default async function InstructorPerformancePage() {
  const {
    pastSessionCount,
    completedPreparations,
    preparationRate,
    sessionsFullyFinalized,
    attendanceCompletionRate,
    certificationsEarned,
    growthEvents,
  } = await getInstructorPerformance();

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeaderV2
        eyebrow="Instructor development"
        title="Performance evidence"
        subtitle="Each figure below is computed from real records and labeled with its source. No composite score, no ranking."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PerformanceTile
          label="Preparation completion"
          value={formatRate(preparationRate)}
          detail={`${completedPreparations} of ${pastSessionCount} past sessions prepared`}
        />
        <PerformanceTile
          label="Attendance completion"
          value={formatRate(attendanceCompletionRate)}
          detail={`${sessionsFullyFinalized} of ${pastSessionCount} past sessions fully finalized`}
        />
        <PerformanceTile
          label="Certifications earned"
          value={String(certificationsEarned)}
          detail="From InstructorCertification, status Certified"
        />
        <PerformanceTile
          label="Past sessions"
          value={String(pastSessionCount)}
          detail="Across all your assigned classes"
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Recent development events</h2>
        {growthEvents.length === 0 ? (
          <EmptyStateV2
            title="No development events recorded yet"
            body="Recognition, feedback, and growth events will appear here as they're recorded."
          />
        ) : (
          growthEvents.map((event) => (
            <CardV2 key={event.id} padding="md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{event.title}</h3>
                  {event.description ? <p className="mt-1 text-sm text-ink-muted">{event.description}</p> : null}
                </div>
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {pretty(event.category)}
                </span>
              </div>
              <p className="mt-2 text-xs text-ink-muted">{shortDate(event.occurredAt)}</p>
            </CardV2>
          ))
        )}
      </div>
    </main>
  );
}
