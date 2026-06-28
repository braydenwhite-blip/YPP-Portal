"use client";

// The Instructor Cockpit — mobile-first and calm. Answers "what am I teaching?"
// and "what needs me today?" with one-tap routes into each class's command
// surface. Read-only; all mutations live on the class detail page.

import { CardV2, StatusBadge, ButtonLink, EmptyStateV2, cn, type StatusTone } from "@/components/ui-v2";
import { shortDate } from "@/lib/chapters/format";
import type { ClassRuntimeHealth } from "@/lib/classes/class-runtime";
import type { CockpitClass, InstructorCockpit } from "@/lib/classes/cockpit";

const HEALTH_TONE: Record<ClassRuntimeHealth, StatusTone> = {
  healthy: "success",
  watch: "info",
  at_risk: "warning",
  critical: "danger",
  unknown: "neutral",
};

export function InstructorCockpitView({ cockpit }: { cockpit: InstructorCockpit }) {
  const { summary, today, needsYou, classes } = cockpit;

  if (classes.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Header />
        <div className="mt-6">
          <EmptyStateV2
            title="No classes assigned yet"
            body="When you are assigned to teach a class, it shows up here with everything you need to run it — roster, schedule, attendance, and reflections."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <Header />

      <div className="mt-5 grid grid-cols-4 gap-2">
        <Stat label="Classes" value={summary.total} />
        <Stat label="Live" value={summary.live} tone={summary.live > 0 ? "success" : "neutral"} />
        <Stat label="Attendance" value={summary.attendanceDue} tone={summary.attendanceDue > 0 ? "warning" : "neutral"} />
        <Stat label="Need you" value={needsYou.length} tone={needsYou.length > 0 ? "warning" : "neutral"} />
      </div>

      {today.length > 0 && (
        <Section title="Today">
          {today.map((c) => (
            <ClassCard key={c.id} c={c} highlightToday />
          ))}
        </Section>
      )}

      {needsYou.length > 0 && (
        <Section title="Needs you">
          {needsYou.map((c) => (
            <ClassCard key={c.id} c={c} />
          ))}
        </Section>
      )}

      <Section title="My classes">
        {classes.map((c) => (
          <ClassCard key={c.id} c={c} compact />
        ))}
      </Section>
    </div>
  );
}

function Header() {
  return (
    <div>
      <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-brand-700">Instructor</p>
      <h1 className="m-0 mt-1 text-[22px] font-bold text-ink">My Classes</h1>
      <p className="m-0 mt-1 text-[13.5px] text-ink-muted">Everything you&rsquo;re teaching, and what needs you today.</p>
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: StatusTone }) {
  const text =
    tone === "success" ? "text-complete-700" : tone === "warning" ? "text-progress-700" : "text-ink";
  return (
    <div className="rounded-[12px] border border-line-card bg-surface px-2.5 py-2 text-center">
      <div className={cn("text-[20px] font-bold leading-none", text)}>{value}</div>
      <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="m-0 mb-2 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-muted">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function ClassCard({ c, highlightToday, compact }: { c: CockpitClass; highlightToday?: boolean; compact?: boolean }) {
  const dueChips: { label: string; tone: StatusTone }[] = [];
  if (c.attendanceDueSession) dueChips.push({ label: "Attendance due", tone: "warning" });
  if (c.reflectionDueSession) dueChips.push({ label: "Reflection due", tone: "info" });
  if (c.atRiskCount > 0) dueChips.push({ label: `${c.atRiskCount} at risk`, tone: "warning" });

  return (
    <CardV2 padding="none" className={cn("overflow-hidden", highlightToday && "ring-1 ring-brand-200")}>
      <a href={`/instructor/classes/${c.id}`} className="block px-4 py-3.5 transition-colors hover:bg-surface-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[15px] font-bold text-ink">{c.title}</h3>
            <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
              {c.scheduleLabel} · {c.locationLabel}
            </p>
          </div>
          <StatusBadge tone={HEALTH_TONE[c.health]} withDot>
            {c.stageLabel}
          </StatusBadge>
        </div>

        {!compact && (
          <p className="m-0 mt-2 text-[12.5px] font-medium text-ink">
            {c.nextSession ? (
              <>Next: {shortDate(c.nextSession.date)} · {c.nextSession.topic || `Session ${c.nextSession.sessionNumber}`}</>
            ) : (
              <span className="text-ink-muted">No upcoming session scheduled</span>
            )}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-ink-muted">{c.rosterCount} enrolled</span>
          {dueChips.map((chip) => (
            <StatusBadge key={chip.label} tone={chip.tone}>
              {chip.label}
            </StatusBadge>
          ))}
        </div>
      </a>

      {(c.attendanceDueSession || c.reflectionDueSession) && (
        <div className="flex gap-2 border-t border-line-card px-4 py-2.5">
          {c.attendanceDueSession && (
            <ButtonLink href={`/instructor/classes/${c.id}#attendance`} variant="primary" size="sm">
              Take attendance
            </ButtonLink>
          )}
          {c.reflectionDueSession && (
            <ButtonLink href={`/instructor/classes/${c.id}#reflection`} variant="secondary" size="sm">
              Reflect
            </ButtonLink>
          )}
        </div>
      )}
    </CardV2>
  );
}
