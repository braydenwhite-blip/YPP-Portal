"use client";

// The four "Deliberables" — Partner Pipeline, Instructor Pipeline, Curriculum
// Readiness, Class Launch Readiness. Each is one evidence-backed decision view:
// a guiding question, four KPI stats, a real evidence table (no black-box
// scores), and a single recommended next step. Fed entirely by
// `loadChapterOperatingSystem().deliberables` — read-only; every row links into
// the workflow that resolves it.

import {
  ButtonLink,
  CardV2,
  DataTableShell,
  EmptyStateV2,
  StatusBadge,
  TableV2,
  TableCell,
  TableHeadCell,
  cn,
  type StatusTone,
} from "@/components/ui-v2";
import type {
  ChapterOperatingSystem,
  DeliberableStat,
  DeliberableStatTone,
} from "@/lib/chapters/operating-system";
import type { EvidenceStatus, InstructorEvidenceStatus } from "@/lib/chapters/pipeline";
import type { CurriculumEvidenceStatus } from "@/lib/chapters/curriculum-review";
import type { ClassEvidenceStatus } from "@/lib/chapters/launch-readiness";

type Deliberables = ChapterOperatingSystem["deliberables"];
/** The discriminated union of the four deliberables (narrow on `.id`). */
export type Deliberable = Deliberables[keyof Deliberables];

// ---------------------------------------------------------------------------
// The reusable Deliberable template
// ---------------------------------------------------------------------------

export function DeliberableView({ deliberable }: { deliberable: Deliberable }) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em] text-ink-muted">
          <span>Operating System</span>
          <span aria-hidden>›</span>
          <span>Deliberables</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-[20px] font-bold text-ink">{deliberable.title}</h2>
            <p className="m-0 mt-0.5 text-[13.5px] text-ink-muted">{deliberable.question}</p>
          </div>
          <StatusBadge tone="success" withDot>
            Evidence-backed
          </StatusBadge>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {deliberable.stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </div>

      <EvidenceTable deliberable={deliberable} />

      <RecommendedNextStep recommendation={deliberable.recommendation} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI stat card
// ---------------------------------------------------------------------------

const STAT_NUMBER_COLOR: Record<DeliberableStatTone, string> = {
  neutral: "text-ink",
  positive: "text-complete-700",
  warning: "text-progress-700",
  danger: "text-blocked-700",
};
const STAT_CARD_TINT: Record<DeliberableStatTone, string> = {
  neutral: "border-line-card bg-surface",
  positive: "border-line-card bg-surface",
  warning: "border-progress-100 bg-progress-50",
  danger: "border-blocked-100 bg-blocked-50",
};

function StatCard({ stat }: { stat: DeliberableStat }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-[12px] border p-4", STAT_CARD_TINT[stat.tone])}>
      <span className={cn("text-[26px] font-bold leading-none", STAT_NUMBER_COLOR[stat.tone])}>{stat.value}</span>
      <span className="text-[13px] font-semibold text-ink">{stat.label}</span>
      <span className="text-[11.5px] text-ink-muted">{stat.hint}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recommended next step
// ---------------------------------------------------------------------------

function RecommendedNextStep({
  recommendation,
}: {
  recommendation: Deliberable["recommendation"];
}) {
  return (
    <CardV2 padding="md" className="flex flex-wrap items-center justify-between gap-4 bg-brand-50">
      <div className="min-w-0">
        <p className="m-0 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-brand-700">
          <span aria-hidden>⚡</span> Recommended next step
        </p>
        <p className="m-0 mt-1 text-[14px] font-medium text-brand-900">{recommendation.text}</p>
      </div>
      <ButtonLink href={recommendation.href} variant="primary" size="sm">
        {recommendation.cta}
      </ButtonLink>
    </CardV2>
  );
}

// ---------------------------------------------------------------------------
// Evidence tables (one renderer per deliberable, narrowed on `id`)
// ---------------------------------------------------------------------------

function EvidenceTable({ deliberable }: { deliberable: Deliberable }) {
  const shown = deliberable.rows.length;
  const total = deliberable.totalRows;
  if (total === 0) {
    return (
      <CardV2>
        <EmptyStateV2 title="No evidence yet" body="As soon as there's real data in this lane, it shows up here." />
      </CardV2>
    );
  }
  return (
    <DataTableShell
      header={
        <>
          <span className="text-[13px] font-bold text-ink">Evidence</span>
          <span className="text-[12px] text-ink-muted">
            {shown < total ? `Showing ${shown} of ${total}` : `${total} total`}
          </span>
        </>
      }
    >
      <TableV2>{renderTableBody(deliberable)}</TableV2>
    </DataTableShell>
  );
}

function renderTableBody(deliberable: Deliberable) {
  switch (deliberable.id) {
    case "partner":
      return <PartnerBody rows={deliberable.rows} />;
    case "instructor":
      return <InstructorBody rows={deliberable.rows} />;
    case "curriculum":
      return <CurriculumBody rows={deliberable.rows} />;
    case "class":
      return <ClassBody rows={deliberable.rows} />;
  }
}

function NameCell({ name, subtitle }: { name: string; subtitle?: string | null }) {
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-ink">{name}</span>
      {subtitle ? <span className="text-[11.5px] text-ink-muted">{subtitle}</span> : null}
    </div>
  );
}

// --- Partner ---------------------------------------------------------------

const PARTNER_STATUS_BADGE: Record<EvidenceStatus, { tone: StatusTone; label: string }> = {
  on_track: { tone: "success", label: "On Track" },
  at_risk: { tone: "warning", label: "At Risk" },
  stuck: { tone: "danger", label: "Stuck" },
};

function PartnerBody({ rows }: { rows: Extract<Deliberable, { id: "partner" }>["rows"] }) {
  return (
    <>
      <thead>
        <tr>
          <TableHeadCell>Partner</TableHeadCell>
          <TableHeadCell>Stage</TableHeadCell>
          <TableHeadCell>Last Contact</TableHeadCell>
          <TableHeadCell>Next Step</TableHeadCell>
          <TableHeadCell>Status</TableHeadCell>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const s = PARTNER_STATUS_BADGE[r.status];
          return (
            <tr key={r.id}>
              <TableCell>
                <a href={`/partners/${r.id}`} className="hover:underline">
                  <NameCell name={r.name} subtitle={r.subtitle} />
                </a>
              </TableCell>
              <TableCell className="text-ink-muted">{r.stage}</TableCell>
              <TableCell className="text-ink-muted">{r.lastContact}</TableCell>
              <TableCell>{r.nextStep}</TableCell>
              <TableCell>
                <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
              </TableCell>
            </tr>
          );
        })}
      </tbody>
    </>
  );
}

// --- Instructor ------------------------------------------------------------

const INSTRUCTOR_STATUS_BADGE: Record<InstructorEvidenceStatus, { tone: StatusTone; label: string }> = {
  strong: { tone: "success", label: "Strong" },
  on_track: { tone: "info", label: "On Track" },
  at_risk: { tone: "warning", label: "At Risk" },
};

function InstructorBody({ rows }: { rows: Extract<Deliberable, { id: "instructor" }>["rows"] }) {
  return (
    <>
      <thead>
        <tr>
          <TableHeadCell>Instructor</TableHeadCell>
          <TableHeadCell>Stage</TableHeadCell>
          <TableHeadCell>Applied</TableHeadCell>
          <TableHeadCell>Specialties</TableHeadCell>
          <TableHeadCell>Status</TableHeadCell>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const s = INSTRUCTOR_STATUS_BADGE[r.status];
          return (
            <tr key={r.id}>
              <TableCell>
                <span className="font-semibold text-ink">{r.name}</span>
              </TableCell>
              <TableCell className="text-ink-muted">{r.stage}</TableCell>
              <TableCell className="text-ink-muted">{r.applied}</TableCell>
              <TableCell className="text-ink-muted">{r.specialties}</TableCell>
              <TableCell>
                <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
              </TableCell>
            </tr>
          );
        })}
      </tbody>
    </>
  );
}

// --- Curriculum ------------------------------------------------------------

const CURRICULUM_STATUS_BADGE: Record<CurriculumEvidenceStatus, { tone: StatusTone; label: string }> = {
  ready: { tone: "success", label: "Ready" },
  needs_feedback: { tone: "warning", label: "Needs Feedback" },
  not_started: { tone: "neutral", label: "Not Started" },
};

function CurriculumBody({ rows }: { rows: Extract<Deliberable, { id: "curriculum" }>["rows"] }) {
  return (
    <>
      <thead>
        <tr>
          <TableHeadCell>Curriculum</TableHeadCell>
          <TableHeadCell>Subject</TableHeadCell>
          <TableHeadCell>Stage</TableHeadCell>
          <TableHeadCell>Owner</TableHeadCell>
          <TableHeadCell>Status</TableHeadCell>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const s = CURRICULUM_STATUS_BADGE[r.status];
          return (
            <tr key={r.id}>
              <TableCell>
                <span className="font-semibold text-ink">{r.title}</span>
              </TableCell>
              <TableCell className="text-ink-muted">{r.subject}</TableCell>
              <TableCell className="text-ink-muted">{r.stage}</TableCell>
              <TableCell className="text-ink-muted">{r.owner}</TableCell>
              <TableCell>
                <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
              </TableCell>
            </tr>
          );
        })}
      </tbody>
    </>
  );
}

// --- Class -----------------------------------------------------------------

const CLASS_STATUS_BADGE: Record<ClassEvidenceStatus, { tone: StatusTone; label: string }> = {
  ready: { tone: "success", label: "Ready" },
  needs_attention: { tone: "warning", label: "Needs Attention" },
  not_ready: { tone: "danger", label: "Not Ready" },
};
const READINESS_BAR_COLOR: Record<ClassEvidenceStatus, string> = {
  ready: "bg-complete-500",
  needs_attention: "bg-progress-500",
  not_ready: "bg-blocked-500",
};

function ClassBody({ rows }: { rows: Extract<Deliberable, { id: "class" }>["rows"] }) {
  return (
    <>
      <thead>
        <tr>
          <TableHeadCell>Class</TableHeadCell>
          <TableHeadCell>Launch Date</TableHeadCell>
          <TableHeadCell>Enrollment</TableHeadCell>
          <TableHeadCell className="w-[140px]">Readiness</TableHeadCell>
          <TableHeadCell>Status</TableHeadCell>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const s = CLASS_STATUS_BADGE[r.status];
          return (
            <tr key={r.id}>
              <TableCell>
                <NameCell name={r.title} subtitle={r.subtitle} />
              </TableCell>
              <TableCell className="text-ink-muted">{r.launchDate}</TableCell>
              <TableCell className="text-ink-muted">
                {r.enrolled} / {r.capacity}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-idle-100">
                    <div
                      className={cn("h-full rounded-full", READINESS_BAR_COLOR[r.status])}
                      style={{ width: `${Math.min(100, Math.max(0, r.readinessPct))}%` }}
                    />
                  </div>
                  <span className="text-[12px] tabular-nums text-ink-muted">{r.readinessPct}%</span>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
              </TableCell>
            </tr>
          );
        })}
      </tbody>
    </>
  );
}
