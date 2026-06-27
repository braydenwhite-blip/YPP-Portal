"use client";

// The six operating rooms' evidence tables — the compact, highest-value rows for
// each domain. Every row opens the right Entity 360 in place (Partner / Class /
// Applicant / Student person), so the operating system is one connected graph,
// never a dead-end grid. Fed by `EvidencePayload` from the rooms loader.

import {
  DataTableShell,
  EmptyStateV2,
  StatusBadge,
  TableV2,
  TableCell,
  TableHeadCell,
  cn,
  type StatusTone,
} from "@/components/ui-v2";
import { EntityLink } from "@/components/operations/entity-link";
import { PersonLink } from "@/components/people-strategy/person-link";
import type { EvidencePayload } from "@/lib/chapters/operating-rooms";
import type { EvidenceStatus, InstructorEvidenceStatus } from "@/lib/chapters/pipeline";
import type { CurriculumEvidenceStatus } from "@/lib/chapters/curriculum-review";
import type { ClassEvidenceStatus } from "@/lib/chapters/launch-readiness";
import type { StudentEvidenceStatus } from "@/lib/chapters/student-community";
import type { GrowthRowStatus } from "@/lib/chapters/chapter-growth";
import type { ActivityTone } from "@/lib/chapters/operating-rooms";

export function RoomEvidence({ evidence, title }: { evidence: EvidencePayload; title: string }) {
  if (evidence.totalRows === 0) {
    return (
      <section className="flex flex-col gap-3">
        <EvidenceHeading title={title} shown={0} total={0} />
        <div className="rounded-[12px] border border-line-soft bg-surface p-2">
          <EmptyStateV2 title="No evidence yet" body="As soon as there's real data in this room, the highest-value rows show up here." />
        </div>
      </section>
    );
  }
  return (
    <DataTableShell
      header={<EvidenceHeading title={title} shown={evidence.rows.length} total={evidence.totalRows} />}
    >
      <TableV2>
        <EvidenceBody evidence={evidence} />
      </TableV2>
    </DataTableShell>
  );
}

function EvidenceHeading({ title, shown, total }: { title: string; shown: number; total: number }) {
  return (
    <>
      <span className="text-[13px] font-bold text-ink">{title}</span>
      <span className="text-[12px] text-ink-muted">
        {total === 0 ? "Nothing yet" : shown < total ? `Showing ${shown} of ${total}` : `${total} total`}
      </span>
    </>
  );
}

function EvidenceBody({ evidence }: { evidence: EvidencePayload }) {
  switch (evidence.kind) {
    case "partner":
      return <PartnerBody rows={evidence.rows} />;
    case "instructor":
      return <InstructorBody rows={evidence.rows} />;
    case "curriculum":
      return <CurriculumBody rows={evidence.rows} />;
    case "class":
      return <ClassBody rows={evidence.rows} />;
    case "student":
      return <StudentBody rows={evidence.rows} />;
    case "growth":
      return <GrowthBody rows={evidence.rows} />;
  }
}

function Subtitle({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return <span className="block text-[11.5px] text-ink-muted">{text}</span>;
}

// --- Partner ---------------------------------------------------------------

const PARTNER_BADGE: Record<EvidenceStatus, { tone: StatusTone; label: string }> = {
  on_track: { tone: "success", label: "On Track" },
  at_risk: { tone: "warning", label: "At Risk" },
  stuck: { tone: "danger", label: "Stuck" },
};

function PartnerBody({ rows }: { rows: Extract<EvidencePayload, { kind: "partner" }>["rows"] }) {
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
          const s = PARTNER_BADGE[r.status];
          return (
            <tr key={r.id}>
              <TableCell>
                <EntityLink type="partner" id={r.id} className="font-semibold text-ink hover:text-brand-700">
                  {r.name}
                </EntityLink>
                <Subtitle text={r.subtitle} />
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

const INSTRUCTOR_BADGE: Record<InstructorEvidenceStatus, { tone: StatusTone; label: string }> = {
  strong: { tone: "success", label: "Strong" },
  on_track: { tone: "info", label: "On Track" },
  at_risk: { tone: "warning", label: "At Risk" },
};

function InstructorBody({ rows }: { rows: Extract<EvidencePayload, { kind: "instructor" }>["rows"] }) {
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
          const s = INSTRUCTOR_BADGE[r.status];
          return (
            <tr key={r.id}>
              <TableCell>
                <EntityLink type="applicant" id={r.id} className="font-semibold text-ink hover:text-brand-700">
                  {r.name}
                </EntityLink>
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

// --- Curriculum (no Entity 360 — the review queue is the surface) -----------

const CURRICULUM_BADGE: Record<CurriculumEvidenceStatus, { tone: StatusTone; label: string }> = {
  ready: { tone: "success", label: "Ready" },
  needs_feedback: { tone: "warning", label: "Needs Feedback" },
  not_started: { tone: "neutral", label: "Not Started" },
};

function CurriculumBody({ rows }: { rows: Extract<EvidencePayload, { kind: "curriculum" }>["rows"] }) {
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
          const s = CURRICULUM_BADGE[r.status];
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

const CLASS_BADGE: Record<ClassEvidenceStatus, { tone: StatusTone; label: string }> = {
  ready: { tone: "success", label: "Ready" },
  needs_attention: { tone: "warning", label: "Needs Attention" },
  not_ready: { tone: "danger", label: "Not Ready" },
};
const CLASS_BAR: Record<ClassEvidenceStatus, string> = {
  ready: "bg-complete-500",
  needs_attention: "bg-progress-500",
  not_ready: "bg-blocked-500",
};

function ClassBody({ rows }: { rows: Extract<EvidencePayload, { kind: "class" }>["rows"] }) {
  return (
    <>
      <thead>
        <tr>
          <TableHeadCell>Class</TableHeadCell>
          <TableHeadCell>Launch</TableHeadCell>
          <TableHeadCell>Enrollment</TableHeadCell>
          <TableHeadCell className="w-[140px]">Readiness</TableHeadCell>
          <TableHeadCell>Status</TableHeadCell>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const s = CLASS_BADGE[r.status];
          return (
            <tr key={r.id}>
              <TableCell>
                <EntityLink type="class" id={r.id} className="font-semibold text-ink hover:text-brand-700">
                  {r.title}
                </EntityLink>
                <Subtitle text={r.subtitle} />
              </TableCell>
              <TableCell className="text-ink-muted">{r.launchDate}</TableCell>
              <TableCell className="text-ink-muted">
                {r.enrolled} / {r.capacity}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-idle-100">
                    <div
                      className={cn("h-full rounded-full", CLASS_BAR[r.status])}
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

// --- Student ---------------------------------------------------------------

const STUDENT_BADGE: Record<StudentEvidenceStatus, { tone: StatusTone; label: string }> = {
  thriving: { tone: "success", label: "Thriving" },
  at_risk: { tone: "warning", label: "At Risk" },
  inactive: { tone: "danger", label: "Inactive" },
};

function StudentBody({ rows }: { rows: Extract<EvidencePayload, { kind: "student" }>["rows"] }) {
  return (
    <>
      <thead>
        <tr>
          <TableHeadCell>Student</TableHeadCell>
          <TableHeadCell>Class</TableHeadCell>
          <TableHeadCell>Attendance</TableHeadCell>
          <TableHeadCell>Feedback</TableHeadCell>
          <TableHeadCell>Status</TableHeadCell>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const s = STUDENT_BADGE[r.status];
          return (
            <tr key={r.id}>
              <TableCell>
                <PersonLink id={r.id} className="font-semibold text-ink hover:text-brand-700">
                  {r.name}
                </PersonLink>
              </TableCell>
              <TableCell className="text-ink-muted">{r.className}</TableCell>
              <TableCell className="text-ink-muted">{r.attendance}</TableCell>
              <TableCell className="text-ink-muted">{r.feedback}</TableCell>
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

// --- Growth ----------------------------------------------------------------

const GROWTH_BADGE: Record<GrowthRowStatus, { tone: StatusTone; label: string }> = {
  done: { tone: "success", label: "Done" },
  on_track: { tone: "info", label: "On Track" },
  behind: { tone: "warning", label: "Behind" },
  upcoming: { tone: "neutral", label: "Upcoming" },
};
const TREND_COLOR: Record<ActivityTone, string> = {
  good: "text-complete-700",
  warn: "text-blocked-700",
  neutral: "text-ink-muted",
};

function GrowthBody({ rows }: { rows: Extract<EvidencePayload, { kind: "growth" }>["rows"] }) {
  return (
    <>
      <thead>
        <tr>
          <TableHeadCell>Goal</TableHeadCell>
          <TableHeadCell>Current</TableHeadCell>
          <TableHeadCell>Target</TableHeadCell>
          <TableHeadCell>Trend</TableHeadCell>
          <TableHeadCell>Status</TableHeadCell>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const s = GROWTH_BADGE[r.status];
          return (
            <tr key={r.id}>
              <TableCell>
                <span className="font-semibold text-ink">{r.label}</span>
              </TableCell>
              <TableCell className="text-ink-muted">{r.current}</TableCell>
              <TableCell className="text-ink-muted">{r.target}</TableCell>
              <TableCell>
                <span className={cn("font-semibold tabular-nums", TREND_COLOR[r.trendTone])}>{r.trend}</span>
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
