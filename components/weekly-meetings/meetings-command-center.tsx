import Link from "next/link";

import { ButtonLink, CardV2, cn } from "@/components/ui-v2";
import type { ImpactMeetingPrep } from "@/lib/chapters/impact-meeting";
import type { MeetingsCommandCenter } from "@/lib/weekly-meetings/meetings-command-center";

export function ImpactMeetingPrepPanel({ impact }: { impact: ImpactMeetingPrep }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[17px] font-bold text-ink">Impact meeting prep</h2>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Week {impact.weekNumber} · {impact.focus} · {impact.weekLabel}
          </p>
          <p className="m-0 mt-1 text-[12px] text-ink-muted">
            Auto-generated from your chapter data — bring these numbers to your weekly impact meeting.
          </p>
        </div>
        <ButtonLink href="/my-weekly-impact" variant="secondary" size="sm">
          Write narrative
        </ButtonLink>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {impact.groups.map((g) => (
          <CardV2 key={g.title} padding="md" className="flex flex-col gap-3">
            <p className="m-0 text-[13px] font-bold text-ink">{g.title}</p>
            <div className="grid grid-cols-2 gap-3">
              {g.metrics.map((m) => (
                <div key={m.label} className="flex flex-col">
                  <span
                    className={cn(
                      "text-[22px] font-bold leading-none",
                      m.attention ? "text-blocked-700" : "text-ink",
                    )}
                  >
                    {m.value}
                  </span>
                  <span className="mt-1 text-[11.5px] font-medium text-ink-muted">{m.label}</span>
                  {m.detail ? (
                    <span className={cn("text-[11px]", m.attention ? "text-blocked-700" : "text-ink-muted")}>
                      {m.detail}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </CardV2>
        ))}
      </div>

      {impact.blockers.length > 0 ? (
        <CardV2 padding="md">
          <p className="m-0 text-[13px] font-bold text-ink">Open blockers to raise</p>
          <ul className="m-0 mt-2 flex list-disc flex-col gap-1 pl-5">
            {impact.blockers.map((b, i) => (
              <li key={i} className="text-[13px] text-ink">
                {b}
              </li>
            ))}
          </ul>
        </CardV2>
      ) : null}

      <CardV2 padding="md" className="bg-brand-50">
        <p className="m-0 text-[13px] font-bold text-brand-900">Bring your honest narrative</p>
        <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
          {impact.narrativePrompts.map((q) => (
            <li key={q} className="flex items-start gap-2 text-[13px] text-brand-900">
              <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-brand-500" />
              {q}
            </li>
          ))}
        </ul>
      </CardV2>
    </section>
  );
}

export function MeetingsCommandCenterPanels({ data }: { data: MeetingsCommandCenter }) {
  return (
    <div className="flex flex-col gap-6">
      {data.alerts.length > 0 ? (
        <CardV2 padding="md" className="border-blocked-200 bg-blocked-50/40">
          <p className="m-0 text-[13px] font-bold text-ink">Alerts — overdue & missing</p>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
            {data.alerts.map((a) => (
              <li key={`${a.href}-${a.title}`}>
                <Link
                  href={a.href}
                  className={cn(
                    "block rounded-lg border px-3 py-2 text-[13px] no-underline transition-colors hover:bg-surface",
                    a.severity === "critical"
                      ? "border-blocked-300 bg-surface text-blocked-900"
                      : "border-progress-300 bg-surface text-ink",
                  )}
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </CardV2>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="This week" value={data.operational.upcomingThisWeek} hint="Upcoming meetings" />
        <StatTile label="Follow-ups" value={data.operational.openFollowUps} hint="Open tasks" />
        <StatTile
          label="Partner meetings"
          value={data.operational.partnerMeetingsScheduled}
          hint="Scheduled in CRM"
        />
        <StatTile
          label="Partner follow-ups"
          value={data.partnerPipeline?.followUpNeeded ?? 0}
          hint="Need outreach"
        />
      </div>

      {data.impact ? (
        <CardV2 padding="lg">
          <ImpactMeetingPrepPanel impact={data.impact} />
        </CardV2>
      ) : null}

      {data.partnerPipeline ? (
        <CardV2 padding="md">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="m-0 text-[15px] font-bold text-ink">Partner pipeline</h2>
              <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
                CRM status for partner meetings — research through confirmed.
              </p>
            </div>
            <ButtonLink href="/partners" variant="secondary" size="sm">
              Partner CRM
            </ButtonLink>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.partnerPipeline.byStatus.map((s) => (
              <span
                key={s.status}
                className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-soft px-3 py-1 text-[12px] font-medium text-ink"
              >
                {s.label}
                <span className="font-bold text-brand-700">{s.count}</span>
              </span>
            ))}
          </div>
          {data.partnersNeedingFollowUp.length > 0 ? (
            <div className="mt-4 border-t border-line-soft pt-4">
              <p className="m-0 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                Follow-up reminders
              </p>
              <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                {data.partnersNeedingFollowUp.map((p) => (
                  <li key={p.id}>
                    <Link href={p.href} className="text-[13px] text-brand-700 hover:underline">
                      {p.name}
                    </Link>
                    <span className="text-[12px] text-ink-muted"> — {p.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardV2>
      ) : null}

      {data.instructorPipeline ? (
        <CardV2 padding="md">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="m-0 text-[15px] font-bold text-ink">Instructor recruiting pipeline</h2>
              <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
                Applicant CRM — applied through hired, for impact meeting reporting.
              </p>
            </div>
            <ButtonLink href="/admin/instructor-applicants" variant="secondary" size="sm">
              Applicant board
            </ButtonLink>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Applicants" value={data.instructorPipeline.applicants} hint="This cycle" />
            <StatTile label="In review" value={data.instructorPipeline.waitingForReview} hint="Needs reviewer" />
            <StatTile
              label="Interviews"
              value={data.instructorPipeline.interviewsScheduled}
              hint="Scheduled"
            />
            <StatTile label="Hired" value={data.instructorPipeline.hired} hint="Ready to assign" />
          </div>
        </CardV2>
      ) : null}

      {data.meetingsNeedingWorkspace.length > 0 ? (
        <CardV2 padding="md">
          <h2 className="m-0 text-[15px] font-bold text-ink">Partner meeting workspace — incomplete</h2>
          <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
            Every meeting needs agenda, proposal, notes, follow-ups, next steps, owner, linked partner, and outcome.
          </p>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
            {data.meetingsNeedingWorkspace.map((m) => (
              <li key={m.id}>
                <Link href={m.href} className="font-medium text-brand-700 hover:underline">
                  {m.title}
                </Link>
                <span className="text-[12px] text-ink-muted"> — missing: {m.missing.join(", ")}</span>
              </li>
            ))}
          </ul>
        </CardV2>
      ) : null}

      <CardV2 padding="md" className="bg-surface-soft">
        <p className="m-0 text-[13px] font-bold text-ink">Quick links</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink href="/meetings/new" variant="secondary" size="sm">
            Schedule partner meeting
          </ButtonLink>
          <ButtonLink href="/partners" variant="secondary" size="sm">
            Partner database
          </ButtonLink>
          <ButtonLink href="/my-weekly-impact" variant="secondary" size="sm">
            Weekly impact form
          </ButtonLink>
          {data.chapterHref ? (
            <ButtonLink href={data.chapterHref} variant="secondary" size="sm">
              {data.chapterName ? `${data.chapterName} operating system` : "Chapter dashboard"}
            </ButtonLink>
          ) : null}
          <ButtonLink href="/actions" variant="ghost" size="sm">
            Task management
          </ButtonLink>
        </div>
      </CardV2>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-[12px] border border-line-soft bg-surface px-3 py-3 shadow-sm">
      <p className="m-0 text-[22px] font-bold leading-none text-ink">{value}</p>
      <p className="m-0 mt-1 text-[12px] font-semibold text-ink">{label}</p>
      <p className="m-0 text-[11px] text-ink-muted">{hint}</p>
    </div>
  );
}
