"use client";

import Link from "next/link";

import {
  PIPELINE_STAGE_LABELS,
  stageForStatus,
} from "@/components/instructor-applicants/ApplicantPipelineCard";

const SOURCE_LABELS: Record<string, string> = {
  PORTAL: "Portal",
  GOOGLE_FORMS: "Google Forms",
  CSV_IMPORT: "CSV import",
  MANUAL: "Manual entry",
  MANUAL_ADMIN_ENTRY: "Manual entry",
};

const TRACK_FILTER: Record<string, { param: string; label: string }> = {
  STANDARD_INSTRUCTOR: { param: "standard", label: "Full Instructor" },
  SUMMER_WORKSHOP_INSTRUCTOR: { param: "summer_workshop", label: "Summer Workshop" },
};

const SOURCE_FILTER: Record<string, string> = {
  PORTAL: "portal",
  GOOGLE_FORMS: "google_forms",
  CSV_IMPORT: "csv_import",
  MANUAL: "manual",
  MANUAL_ADMIN_ENTRY: "manual",
};

function boardHref(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams({ view: "pipeline" });
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return `/admin/instructor-applicants?${search.toString()}`;
}

export function ApplicationRecordBoardFilterChips({
  status,
  interviewScheduledAtISO,
  chapterId,
  chapterName,
  applicationTrack,
  source,
  reviewerId,
  reviewerName,
  interviewerAssignments,
}: {
  status: string;
  interviewScheduledAtISO: string | null;
  chapterId: string | null;
  chapterName: string | null;
  applicationTrack: string;
  source: string;
  reviewerId: string | null;
  reviewerName: string | null;
  interviewerAssignments: Array<{
    role: string;
    interviewer: { id: string; name: string };
  }>;
}) {
  const stage = stageForStatus({
    status,
    interviewScheduledAt: interviewScheduledAtISO,
  });
  const statusLabel = PIPELINE_STAGE_LABELS[stage] ?? status.replace(/_/g, " ");
  const track = TRACK_FILTER[applicationTrack];
  const sourceParam = SOURCE_FILTER[source];
  const sourceLabel = SOURCE_LABELS[source] ?? source.replace(/_/g, " ");

  const items: Array<{ key: string; href: string; label: string }> = [
    {
      key: "status",
      href: boardHref({ status: stage || undefined }),
      label: statusLabel,
    },
  ];

  if (chapterId && chapterName) {
    items.push({ key: "chapter", href: boardHref({ chapterId }), label: chapterName });
  }
  if (track) {
    items.push({ key: "track", href: boardHref({ track: track.param }), label: track.label });
  }
  if (sourceParam) {
    items.push({ key: "source", href: boardHref({ source: sourceParam }), label: sourceLabel });
  }
  if (reviewerId && reviewerName) {
    items.push({
      key: "reviewer",
      href: boardHref({ reviewerId }),
      label: `Reviewer ${reviewerName}`,
    });
  }
  for (const assignment of interviewerAssignments) {
    const role =
      assignment.role === "LEAD" ? "Lead" : assignment.role === "SECOND" ? "Second" : "Interviewer";
    items.push({
      key: `interviewer-${assignment.interviewer.id}-${assignment.role}`,
      href: boardHref({ interviewerId: assignment.interviewer.id }),
      label: `${role} ${assignment.interviewer.name}`,
    });
  }

  return (
    <div className="mt-3 border-t border-line-soft pt-2.5">
      <p className="m-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-relaxed text-ink-muted">
        <span className="font-semibold text-ink-muted/80">Board</span>
        {items.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-x-1.5">
            <span aria-hidden className="text-ink-muted/40">
              ·
            </span>
            <Link
              href={item.href}
              title={`Open board filtered: ${item.label}`}
              className="text-ink-muted no-underline hover:text-brand-700 hover:underline"
            >
              {item.label}
            </Link>
          </span>
        ))}
      </p>
    </div>
  );
}
