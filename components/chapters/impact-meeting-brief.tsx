// The Impact Meeting brief — a generated weekly brief a Chapter President can
// open during the meeting and speak from, top to bottom: what changed, the
// numbers, per-lane updates, wins, open work, risks & support, decisions, and
// next week's commitments. Server-rendered; every number comes from the
// deterministic builder in lib/chapters/impact-brief.ts.

import Link from "next/link";

import { CardV2, SectionHeaderV2, StatusBadge, type StatusTone } from "@/components/ui-v2";
import type {
  BriefActionRecord,
  BriefLaneUpdate,
  BriefReadinessState,
  ChapterImpactBrief,
} from "@/lib/chapters/impact-brief";
import type { ChapterImpactBriefModel } from "@/lib/chapters/impact-brief-server";
import type { ExpectationProgress } from "@/lib/chapters/expectations";

export const READINESS_TONE: Record<BriefReadinessState, StatusTone> = {
  ready: "success",
  almost: "warning",
  not_ready: "danger",
};

const GROWTH_TONE: Record<string, StatusTone> = {
  Strong: "success",
  Improving: "success",
  Flat: "neutral",
  Slipping: "warning",
  Critical: "danger",
  "No Baseline Yet": "info",
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function ActionLine({ action, showDue = true }: { action: BriefActionRecord; showDue?: boolean }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-line-soft py-1.5 text-[13px] last:border-0">
      <Link href={`/actions/${action.id}`} className="text-ink hover:text-brand-800 hover:underline">
        {action.title}
      </Link>
      <span className="shrink-0 text-[11.5px] text-ink-muted">
        {action.leadName ?? "Unassigned"}
        {showDue && action.dueAt ? ` · due ${fmtDate(action.dueAt)}` : ""}
      </span>
    </li>
  );
}

function ExpectationBar({ row }: { row: ExpectationProgress }) {
  const tone =
    row.status === "met" ? "bg-emerald-500" : row.status === "close" ? "bg-amber-400" : "bg-brand-400";
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12.5px]">
        <span className="font-medium text-ink">{row.label}</span>
        <span className="text-ink-muted">{row.summary}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-soft">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${row.percent}%` }} />
      </div>
    </div>
  );
}

function LaneCard({ lane }: { lane: BriefLaneUpdate }) {
  return (
    <CardV2 as="section" padding="md" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Link href={lane.href} className="text-[14px] font-bold text-ink hover:text-brand-800 hover:underline">
          {lane.title}
        </Link>
        {lane.attentionCount > 0 && (
          <StatusBadge tone="warning">{lane.attentionCount} need attention</StatusBadge>
        )}
      </div>
      <p className="text-[12.5px] text-ink-muted">{lane.headline}</p>
      {lane.changed.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-[12.5px] text-ink">
          {lane.changed.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] italic text-ink-muted">No movement this week</p>
      )}
      <p className="mt-auto border-t border-line-soft pt-2 text-[12.5px] text-ink">
        <span className="font-semibold text-ink-muted">Next: </span>
        {lane.nextStep}
      </p>
    </CardV2>
  );
}

export function ImpactMeetingBrief({ model }: { model: ChapterImpactBriefModel }) {
  const { brief, prep } = model;
  const overdue = brief.openWork.overdue;
  const waiting = brief.openWork.waiting;
  const completed = brief.openWork.completedThisWeek;
  const dueNextWeek = brief.openWork.dueNextWeek;

  return (
    <div className="flex flex-col gap-6">
      {/* Headline */}
      <CardV2 padding="md" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusBadge tone={GROWTH_TONE[brief.whatChanged.status] ?? "neutral"} withDot>
            {brief.whatChanged.status}
          </StatusBadge>
          <p className="text-[14px] font-medium text-ink">{brief.headline}</p>
        </div>
        {brief.meeting ? (
          <Link
            href={`/meetings/${brief.meeting.id}`}
            className="text-[12.5px] font-semibold text-brand-800 hover:underline"
          >
            {brief.meeting.isThisWeek ? "Open this week's meeting" : "Open next Impact Meeting"} ·{" "}
            {fmtDate(brief.meeting.scheduledAt)}
          </Link>
        ) : (
          <Link href="/meetings/new" className="text-[12.5px] font-semibold text-brand-800 hover:underline">
            Schedule this week's Impact Meeting
          </Link>
        )}
      </CardV2>

      {/* What changed + missing data */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardV2 as="section" padding="md" className="flex flex-col gap-2">
          <SectionHeaderV2 title="What changed this week" />
          {brief.whatChanged.improvements.length === 0 && brief.whatChanged.regressions.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              No week-over-week movement recorded yet. Keep logging activity — trends appear once a
              baseline week exists.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 text-[13px]">
              {brief.whatChanged.improvements.map((line) => (
                <p key={line} className="text-emerald-700">▲ {line}</p>
              ))}
              {brief.whatChanged.regressions.map((line) => (
                <p key={line} className="text-blocked-700">▼ {line}</p>
              ))}
            </div>
          )}
        </CardV2>

        <CardV2 as="section" padding="md" className="flex flex-col gap-2">
          <SectionHeaderV2
            title="Data check"
            description="What's missing before this brief is complete."
          />
          {brief.missingData.length === 0 ? (
            <p className="text-[13px] font-medium text-emerald-700">
              ✓ All weekly data is in — this brief is meeting-ready.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {brief.missingData.map((item) => (
                <li key={item.key} className="text-[13px]">
                  <span className="font-medium text-ink">{item.label}.</span>{" "}
                  <Link href={item.href} className="text-brand-800 hover:underline">
                    {item.action}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardV2>
      </div>

      {/* Numbers: playbook metrics + expectations */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardV2 as="section" padding="md" className="flex flex-col gap-3">
          <SectionHeaderV2 title="This week's numbers" description={`Week ${brief.weekNumber} · ${brief.focus}`} />
          {prep.groups.map((group) => (
            <div key={group.title}>
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">
                {group.title}
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {group.metrics.map((m) => (
                  <div
                    key={`${group.title}:${m.label}`}
                    className={`rounded-lg border px-2.5 py-2 ${m.attention ? "border-amber-300 bg-amber-50" : "border-line-soft bg-surface-soft"}`}
                  >
                    <p className={`text-[18px] font-bold ${m.attention ? "text-amber-700" : "text-ink"}`}>
                      {m.value}
                    </p>
                    <p className="text-[11.5px] leading-tight text-ink-muted">
                      {m.label}
                      {m.detail ? ` · ${m.detail}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardV2>

        <CardV2 as="section" padding="md" className="flex flex-col gap-3">
          <SectionHeaderV2 title="Chapter expectations" description={brief.expectations.headline} />
          <div className="flex flex-col gap-3">
            {brief.expectations.rows.map((row) => (
              <ExpectationBar key={row.key} row={row} />
            ))}
          </div>
          {brief.expectations.readyToScale && (
            <StatusBadge tone="success" withDot>
              Chapter ready to scale
            </StatusBadge>
          )}
        </CardV2>
      </div>

      {/* Lanes */}
      <section>
        <SectionHeaderV2 title="Operating lanes" description="Partners, instructors, students, and classes — current state and next step." />
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {brief.lanes.map((lane) => (
            <LaneCard key={lane.key} lane={lane} />
          ))}
        </div>
      </section>

      {/* Wins + open work */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CardV2 as="section" padding="md" className="flex flex-col gap-2">
          <SectionHeaderV2 title="Weekly wins" />
          {brief.wins.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No wins recorded yet this week.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-[13px] text-ink">
              {brief.wins.map((w) => (
                <li key={w}>🏆 {w}</li>
              ))}
            </ul>
          )}
        </CardV2>

        <CardV2 as="section" padding="md" className="flex flex-col gap-2 lg:col-span-2">
          <SectionHeaderV2
            title="Open work"
            description={`${brief.openWork.openCount} open · ${completed.length} completed this week`}
            action={
              <Link href={`/actions?ch=${brief.chapter.id}`} className="text-[12.5px] font-semibold text-brand-800 hover:underline">
                All chapter actions
              </Link>
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-blocked-700">
                Overdue ({overdue.length})
              </p>
              {overdue.length === 0 ? (
                <p className="mt-1 text-[12.5px] text-ink-muted">Nothing overdue.</p>
              ) : (
                <ul className="mt-1">{overdue.slice(0, 5).map((a) => <ActionLine key={a.id} action={a} />)}</ul>
              )}
            </div>
            <div>
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-amber-700">
                Waiting on someone ({waiting.length})
              </p>
              {waiting.length === 0 ? (
                <p className="mt-1 text-[12.5px] text-ink-muted">Nothing blocked.</p>
              ) : (
                <ul className="mt-1">{waiting.slice(0, 5).map((a) => <ActionLine key={a.id} action={a} showDue={false} />)}</ul>
              )}
            </div>
            <div>
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">
                Due in the next week ({dueNextWeek.length})
              </p>
              {dueNextWeek.length === 0 ? (
                <p className="mt-1 text-[12.5px] text-ink-muted">Nothing due soon.</p>
              ) : (
                <ul className="mt-1">{dueNextWeek.slice(0, 5).map((a) => <ActionLine key={a.id} action={a} />)}</ul>
              )}
            </div>
            <div>
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-emerald-700">
                Completed this week ({completed.length})
              </p>
              {completed.length === 0 ? (
                <p className="mt-1 text-[12.5px] text-ink-muted">None completed yet.</p>
              ) : (
                <ul className="mt-1">{completed.slice(0, 5).map((a) => <ActionLine key={a.id} action={a} showDue={false} />)}</ul>
              )}
            </div>
          </div>
        </CardV2>
      </div>

      {/* Risks + support requests */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardV2 as="section" padding="md" className="flex flex-col gap-2">
          <SectionHeaderV2 title="Risks & blockers" />
          {brief.risks.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No open risks — pipeline is clear.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {brief.risks.map((r) => (
                <li key={`${r.href}:${r.title}`} className="flex items-start gap-2 text-[13px]">
                  <StatusBadge tone={r.severity === "critical" ? "danger" : "warning"}>
                    {r.severity === "critical" ? "Critical" : "Warning"}
                  </StatusBadge>
                  <span>
                    <Link href={r.href} className="font-medium text-ink hover:text-brand-800 hover:underline">
                      {r.title}
                    </Link>
                    {r.detail ? <span className="text-ink-muted"> — {r.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardV2>

        <CardV2 as="section" padding="md" className="flex flex-col gap-2">
          <SectionHeaderV2 title="Support needed from Global" />
          {brief.supportRequests.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No open support requests.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {brief.supportRequests.map((s) => (
                <li key={s.id} className="text-[13px]">
                  <span className="font-medium text-ink">{s.title}</span>
                  <span className="text-ink-muted">
                    {" "}
                    — {s.category.toLowerCase().replace(/_/g, " ")} ·{" "}
                    {s.assignedToName ? `with ${s.assignedToName}` : "unassigned"} · opened{" "}
                    {fmtDate(s.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardV2>
      </div>

      {/* Decisions + commitments */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardV2 as="section" padding="md" className="flex flex-col gap-2 border-brand-200">
          <SectionHeaderV2 title="Decisions needed" description="Bring these to leadership in the meeting." />
          {brief.decisionsNeeded.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No decisions waiting on leadership.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {brief.decisionsNeeded.map((d) => (
                <li key={d.key} className="text-[13px]">
                  <Link href={d.href} className="font-medium text-ink hover:text-brand-800 hover:underline">
                    {d.title}
                  </Link>
                  {d.detail ? <span className="text-ink-muted"> — {d.detail}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </CardV2>

        <CardV2 as="section" padding="md" className="flex flex-col gap-2">
          <SectionHeaderV2 title="Proposed commitments for next week" />
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] text-ink">
            {brief.commitments.map((c) => (
              <li key={c.text}>
                <Link href={c.href} className="hover:text-brand-800 hover:underline">
                  {c.text}
                </Link>
              </li>
            ))}
          </ol>
        </CardV2>
      </div>

      {/* Talking points */}
      <CardV2 as="section" padding="md" className="flex flex-col gap-2">
        <SectionHeaderV2
          title="Talking points"
          description="The three narrative questions every Impact Meeting answers — speak to these directly."
        />
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] text-ink">
          {brief.narrativePrompts.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </CardV2>
    </div>
  );
}
