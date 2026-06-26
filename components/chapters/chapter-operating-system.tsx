"use client";

// The Chapter Operating System surface — one calm screen where a Chapter
// President sees exactly what needs them across the four playbook lanes
// (partners, instructors, curriculum, classes), which classes aren't ready to
// launch, and what to bring to this week's impact meeting. Read-only and fed
// entirely by `loadChapterOperatingSystem`; each item links into the existing
// workflow that resolves it, and a blocker can be one-click tracked as a real
// ActionItem (no parallel task system).

import { useState, useTransition } from "react";

import {
  CardV2,
  SectionHeaderV2,
  StatusBadge,
  ButtonLink,
  EmptyStateV2,
  cn,
  type StatusTone,
} from "@/components/ui-v2";
import type { ChapterOperatingSystem } from "@/lib/chapters/operating-system";
import type { ChapterBlocker, BlockerSeverity, ChapterLane } from "@/lib/chapters/needs-attention-rules";
import {
  PARTNER_PLAYBOOK_STATUS_LABELS,
  INSTRUCTOR_PLAYBOOK_STAGE_LABELS,
  type PartnerPlaybookStatus,
  type InstructorPlaybookStage,
} from "@/lib/chapters/pipeline";
import { CURRICULUM_PLAYBOOK_STATUS_LABELS } from "@/lib/chapters/curriculum-review";
import { trackChapterBlocker } from "@/lib/chapters/operating-actions";
import { DeliberableView } from "@/components/chapters/chapter-deliberables";

const SEVERITY_TONE: Record<BlockerSeverity, StatusTone> = {
  critical: "danger",
  warning: "warning",
  info: "neutral",
};
const SEVERITY_LABEL: Record<BlockerSeverity, string> = {
  critical: "Critical",
  warning: "Needs attention",
  info: "Heads up",
};
const LANE_LABEL: Record<ChapterLane, string> = {
  partners: "Partners",
  instructors: "Instructors",
  curriculum: "Curriculum",
  classes: "Classes",
};

const OPERATING_TABS = [
  { key: "overview", label: "Overview" },
  { key: "partner", label: "Partners" },
  { key: "instructor", label: "Instructors" },
  { key: "curriculum", label: "Curriculum" },
  { key: "class", label: "Classes" },
] as const;
type OperatingTabKey = (typeof OPERATING_TABS)[number]["key"];

/**
 * The Operating System surface: a calm "Overview" cockpit plus the four
 * evidence-backed Deliberables, switched by a single segmented tab strip
 * (mirrors the playbook's "Operating System › Deliberables" structure).
 */
export function ChapterOperatingSystemTabs({ os }: { os: ChapterOperatingSystem }) {
  const [tab, setTab] = useState<OperatingTabKey>("overview");
  return (
    <div className="flex flex-col gap-6">
      <div className="seg-tabs w-fit" role="tablist">
        {OPERATING_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`seg-tab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <ChapterOperatingSystemView os={os} />
      ) : (
        <DeliberableView deliberable={os.deliberables[tab]} />
      )}
    </div>
  );
}

export function ChapterOperatingSystemView({ os }: { os: ChapterOperatingSystem }) {
  return (
    <div className="flex flex-col gap-8">
      <NeedsAttentionPanel chapterId={os.chapter.id} blockers={os.blockers} summary={os.blockerSummary} />

      <section className="flex flex-col gap-4">
        <SectionHeaderV2
          title="Your four lanes"
          description="Partners, instructors, curriculum, and classes — the whole pipeline at a glance."
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PartnersLane os={os} />
          <InstructorsLane os={os} />
          <CurriculumLane os={os} />
          <ClassesLane os={os} />
        </div>
      </section>

      <LaunchReadinessPanel launch={os.launch} />

      <ImpactMeetingPanel impact={os.impact} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Needs Attention
// ---------------------------------------------------------------------------

function NeedsAttentionPanel({
  chapterId,
  blockers,
  summary,
}: {
  chapterId: string;
  blockers: ChapterBlocker[];
  summary: ChapterOperatingSystem["blockerSummary"];
}) {
  if (blockers.length === 0) {
    return (
      <CardV2>
        <SectionHeaderV2 title="What needs you" />
        <div className="mt-3">
          <EmptyStateV2
            title="Nothing needs you right now"
            body="No follow-ups, reviews, decisions, or launch gaps are open across your four lanes. Keep the momentum going."
          />
        </div>
      </CardV2>
    );
  }

  return (
    <CardV2>
      <SectionHeaderV2
        title="What needs you"
        description="Concrete problems across your chapter — each links to where you fix it."
        action={
          <div className="flex flex-wrap gap-1.5">
            {summary.critical > 0 && <StatusBadge tone="danger">{summary.critical} critical</StatusBadge>}
            {summary.warning > 0 && <StatusBadge tone="warning">{summary.warning} to do</StatusBadge>}
            {summary.info > 0 && <StatusBadge tone="neutral">{summary.info} heads-up</StatusBadge>}
          </div>
        }
      />
      <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
        {blockers.slice(0, 12).map((b) => (
          <BlockerRow key={b.key} chapterId={chapterId} blocker={b} />
        ))}
      </ul>
      {blockers.length > 12 && (
        <p className="mt-3 text-[12.5px] text-ink-muted">
          +{blockers.length - 12} more — resolve the items above to clear the list.
        </p>
      )}
    </CardV2>
  );
}

function BlockerRow({ chapterId, blocker }: { chapterId: string; blocker: ChapterBlocker }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-line-card bg-surface-soft px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={SEVERITY_TONE[blocker.severity]} withDot>
            {SEVERITY_LABEL[blocker.severity]}
          </StatusBadge>
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            {LANE_LABEL[blocker.lane]}
          </span>
        </div>
        <p className="m-0 mt-1 text-[13.5px] font-semibold text-ink">{blocker.title}</p>
        {blocker.detail && <p className="m-0 text-[12.5px] text-ink-muted">{blocker.detail}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a href={blocker.href} className="text-[12.5px] font-semibold text-brand-700 hover:underline">
          Resolve →
        </a>
        <TrackActionButton chapterId={chapterId} blocker={blocker} />
      </div>
    </li>
  );
}

function TrackActionButton({ chapterId, blocker }: { chapterId: string; blocker: ChapterBlocker }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");

  if (state === "done") {
    return <span className="text-[12px] font-semibold text-complete-700">Tracked ✓</span>;
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await trackChapterBlocker({
            chapterId,
            blockerKey: blocker.key,
            title: blocker.suggestedAction,
            detail: blocker.detail,
            severity: blocker.severity,
            entityType: blocker.entityType,
            entityId: blocker.entityId,
          });
          setState(res.ok ? "done" : "error");
        })
      }
      className={cn(
        "rounded-[7px] border border-line-card bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink-muted",
        "transition-colors hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
      )}
      title="Add this to your Action Tracker"
    >
      {pending ? "…" : state === "error" ? "Retry" : "Track"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------

function LaneCard({
  title,
  href,
  linkLabel,
  counts,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  counts: { label: string; value: number; tone?: StatusTone }[];
  children?: React.ReactNode;
}) {
  return (
    <CardV2 className="flex flex-col gap-3">
      <SectionHeaderV2
        title={title}
        action={
          <a href={href} className="text-[12.5px] font-semibold text-brand-700 hover:underline">
            {linkLabel} →
          </a>
        }
      />
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {counts.map((c) => (
          <div key={c.label} className="flex flex-col">
            <span className={cn("text-[20px] font-bold leading-none", c.tone === "danger" ? "text-blocked-700" : c.tone === "warning" ? "text-progress-700" : "text-ink")}>
              {c.value}
            </span>
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">{c.label}</span>
          </div>
        ))}
      </div>
      {children}
    </CardV2>
  );
}

function StatusBreakdown({ entries }: { entries: { label: string; value: number }[] }) {
  const shown = entries.filter((e) => e.value > 0);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 border-t border-line-card pt-3">
      {shown.map((e) => (
        <StatusBadge key={e.label} tone="neutral">
          {e.label}: {e.value}
        </StatusBadge>
      ))}
    </div>
  );
}

function PartnersLane({ os }: { os: ChapterOperatingSystem }) {
  const p = os.partners;
  return (
    <LaneCard
      title="Partners"
      href="/partners"
      linkLabel="Open partners"
      counts={[
        { label: "Total", value: p.total },
        { label: "Confirmed", value: p.confirmed, tone: p.confirmed > 0 ? "success" : undefined },
        { label: "Follow-ups due", value: p.followUpNeeded, tone: p.followUpNeeded > 0 ? "warning" : undefined },
      ]}
    >
      {p.followUps.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-line-card pt-3">
          <p className="m-0 text-[12px] font-semibold text-ink-muted">Follow up with</p>
          {p.followUps.map((f) => (
            <a key={f.id} href={f.href} className="flex items-center justify-between gap-2 text-[13px] hover:underline">
              <span className="truncate font-medium text-ink">{f.name}</span>
              <span className="shrink-0 text-[12px] text-progress-700">{f.reason}</span>
            </a>
          ))}
        </div>
      )}
      <StatusBreakdown
        entries={(Object.keys(PARTNER_PLAYBOOK_STATUS_LABELS) as PartnerPlaybookStatus[]).map((s) => ({
          label: PARTNER_PLAYBOOK_STATUS_LABELS[s],
          value: p.byStatus[s],
        }))}
      />
    </LaneCard>
  );
}

function InstructorsLane({ os }: { os: ChapterOperatingSystem }) {
  const i = os.instructors;
  return (
    <LaneCard
      title="Instructors"
      href="/chapter/recruiting?tab=candidates"
      linkLabel="Open recruiting"
      counts={[
        { label: "Applicants", value: i.applicants },
        { label: "Hired", value: i.hired, tone: i.hired > 0 ? "success" : undefined },
        { label: "Need review", value: i.waitingForReview, tone: i.waitingForReview > 0 ? "warning" : undefined },
        { label: "Decisions due", value: i.decisionOverdue, tone: i.decisionOverdue > 0 ? "danger" : undefined },
      ]}
    >
      <StatusBreakdown
        entries={(Object.keys(INSTRUCTOR_PLAYBOOK_STAGE_LABELS) as InstructorPlaybookStage[]).map((s) => ({
          label: INSTRUCTOR_PLAYBOOK_STAGE_LABELS[s],
          value: i.byStage[s],
        }))}
      />
    </LaneCard>
  );
}

function CurriculumLane({ os }: { os: ChapterOperatingSystem }) {
  const c = os.curriculum;
  return (
    <LaneCard
      title="Curriculum"
      href="/admin/curricula"
      linkLabel="Open review queue"
      counts={[
        { label: "Review needed", value: c.reviewNeeded, tone: c.reviewNeeded > 0 ? "warning" : undefined },
        { label: "Overdue", value: c.reviewOverdue, tone: c.reviewOverdue > 0 ? "danger" : undefined },
        { label: "Needs revision", value: c.needsRevision },
        { label: "Approved", value: c.approved, tone: c.approved > 0 ? "success" : undefined },
      ]}
    >
      <StatusBreakdown
        entries={Object.entries(CURRICULUM_PLAYBOOK_STATUS_LABELS).map(([key, label]) => ({
          label,
          value: c.byStatus[key as keyof typeof c.byStatus],
        }))}
      />
    </LaneCard>
  );
}

function ClassesLane({ os }: { os: ChapterOperatingSystem }) {
  const l = os.launch;
  return (
    <LaneCard
      title="Classes"
      href="/admin/classes"
      linkLabel="Open classes"
      counts={[
        { label: "Total", value: l.total },
        { label: "Ready", value: l.ready, tone: l.ready > 0 ? "success" : undefined },
        { label: "Not ready", value: l.notReady, tone: l.notReady > 0 ? "warning" : undefined },
        { label: "Under-enrolled", value: l.underEnrolled, tone: l.underEnrolled > 0 ? "danger" : undefined },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Launch readiness
// ---------------------------------------------------------------------------

function LaunchReadinessPanel({ launch }: { launch: ChapterOperatingSystem["launch"] }) {
  if (launch.total === 0) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeaderV2 title="Launch readiness" description="Every class's path to a real, on-time launch." />
        <CardV2>
          <EmptyStateV2
            title="No classes yet"
            body="Once you build classes, each one's launch checklist (partner, room, time, instructor, curriculum, enrollment) shows here."
          />
        </CardV2>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-4">
      <SectionHeaderV2
        title="Launch readiness"
        description="Every class's 12-point launch checklist — what's done and what's missing."
        action={
          <StatusBadge tone={launch.notReady > 0 ? "warning" : "success"}>
            {launch.ready}/{launch.total} ready
          </StatusBadge>
        }
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {launch.classes.map((c) => (
          <CardV2 key={c.id} padding="md" className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <p className="m-0 text-[14px] font-semibold text-ink">{c.title}</p>
              <StatusBadge tone={c.ready ? "success" : "warning"}>
                {c.done}/{c.total}
              </StatusBadge>
            </div>
            {c.daysToLaunch != null && (
              <p className="m-0 text-[12px] text-ink-muted">
                {c.hasLaunched
                  ? "Launched"
                  : c.daysToLaunch <= 0
                    ? "Launches today"
                    : `Launches in ${c.daysToLaunch} day${c.daysToLaunch === 1 ? "" : "s"}`}
              </p>
            )}
            {c.enrollmentWarning && (
              <p className="m-0 text-[12.5px] font-medium text-blocked-700">{c.enrollmentWarning}</p>
            )}
            {c.missing.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {c.missing.map((m) => (
                  <span key={m} className="rounded-[6px] bg-progress-50 px-2 py-[2px] text-[11.5px] font-medium text-progress-700">
                    {m}
                  </span>
                ))}
              </div>
            ) : (
              <p className="m-0 text-[12.5px] font-medium text-complete-700">Ready to launch ✓</p>
            )}
          </CardV2>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Impact meeting prep
// ---------------------------------------------------------------------------

function ImpactMeetingPanel({ impact }: { impact: ChapterOperatingSystem["impact"] }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeaderV2
        title="Impact meeting prep"
        description={`Week ${impact.weekNumber} · ${impact.focus} · ${impact.weekLabel}`}
        action={
          <ButtonLink href="/my-weekly-impact" variant="secondary" size="sm">
            Write narrative
          </ButtonLink>
        }
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {impact.groups.map((g) => (
          <CardV2 key={g.title} padding="md" className="flex flex-col gap-3">
            <p className="m-0 text-[13px] font-bold text-ink">{g.title}</p>
            <div className="grid grid-cols-2 gap-3">
              {g.metrics.map((m) => (
                <div key={m.label} className="flex flex-col">
                  <span className={cn("text-[22px] font-bold leading-none", m.attention ? "text-blocked-700" : "text-ink")}>
                    {m.value}
                  </span>
                  <span className="mt-1 text-[11.5px] font-medium text-ink-muted">{m.label}</span>
                  {m.detail && (
                    <span className={cn("text-[11px]", m.attention ? "text-blocked-700" : "text-ink-muted")}>{m.detail}</span>
                  )}
                </div>
              ))}
            </div>
          </CardV2>
        ))}
      </div>

      {impact.blockers.length > 0 && (
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
      )}

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
        <p className="m-0 mt-3 text-[12.5px] text-brand-700">
          The numbers above are calculated from your real data. Add the story in your{" "}
          <a href="/my-weekly-impact" className="font-semibold underline">
            weekly impact form
          </a>
          .
        </p>
      </CardV2>
    </section>
  );
}
