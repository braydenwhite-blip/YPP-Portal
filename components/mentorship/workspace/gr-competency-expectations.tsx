"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui-v2";
import { LEADERSHIP_RATING_SCALE } from "@/lib/leadership-goals-rubric";
import { saveGRCompetencyRoleExamples } from "@/lib/mentorship/gr-competency-actions";
import type { GrCompetencyRow } from "@/lib/mentorship/gr-competency-rows";

function RatingScaleLegend() {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {LEADERSHIP_RATING_SCALE.map((level) => (
        <div
          key={level.id}
          className="rounded-[8px] border border-line-soft bg-surface-soft px-3 py-2"
        >
          <p className="m-0 text-[12px] font-bold text-ink">{level.label}</p>
          <p className="m-0 mt-0.5 text-[11px] leading-snug text-ink-muted">
            {level.description}
          </p>
        </div>
      ))}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <p className="m-0 text-[12.5px] italic text-ink-muted">No bullets for this level.</p>
    );
  }
  return (
    <ul className="m-0 list-disc space-y-1.5 pl-4 text-[12.5px] leading-snug text-ink">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function CompetencyIcon({ index }: { index: number }) {
  const paths = [
    // Bar chart
    "M4 18V10M9 18V6M14 18v-4M19 18V8",
    // Lightbulb
    "M9 18h6M10 21h4M12 3a5 5 0 0 0-3 9c.6.5 1 1.4 1 2.2V15h4v-.8c0-.8.4-1.7 1-2.2A5 5 0 0 0 12 3z",
    // Clock
    "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
    // People
    "M16 19v-1.5a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3V19M17 11a3 3 0 1 0 0-6M13.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z",
    // Trending up
    "M3 17l6-6 4 4 7-7M14 8h6v6",
  ];
  const d = paths[index % paths.length]!;
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-brand-50 text-brand-700"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={d} />
      </svg>
    </span>
  );
}

function parseExampleLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-–—*]+/, "").trim())
    .filter(Boolean);
}

function ExamplesCell({
  row,
  canEdit,
  mentorshipId,
  menteeId,
}: {
  row: GrCompetencyRow;
  canEdit: boolean;
  mentorshipId: string | null;
  menteeId: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(row.roleExamples);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = draft.trim() !== (row.roleExamples ?? "").trim();
  const lines = parseExampleLines(row.roleExamples);

  if (!canEdit || !mentorshipId) {
    if (lines.length === 0) {
      return (
        <p className="m-0 text-[12.5px] italic text-ink-muted">
          No role-specific examples yet.
        </p>
      );
    }
    return <BulletList items={lines} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="min-h-[96px] w-full min-w-[180px] resize-y rounded-[8px] border border-line bg-surface px-2.5 py-2 text-[12.5px] leading-relaxed text-ink outline-none focus:border-brand-400"
        value={draft}
        disabled={pending}
        placeholder={"• Specific example for this role\n• Another concrete goal"}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending || !dirty}
          onClick={() => {
            startTransition(async () => {
              try {
                await saveGRCompetencyRoleExamples({
                  mentorshipId,
                  menteeId,
                  competencyId: row.competencyId,
                  title: row.title,
                  roleExamples: draft,
                  goalId: row.goalId,
                });
                setError(null);
                router.refresh();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Could not save examples.",
                );
              }
            });
          }}
        >
          {pending ? "Saving…" : "Save examples"}
        </Button>
        {error ? (
          <span className="text-[12px] text-danger-700">{error}</span>
        ) : dirty ? (
          <span className="text-[12px] text-ink-muted">Unsaved changes</span>
        ) : null}
      </div>
    </div>
  );
}

export function GrCompetencyExpectationsTable({
  rubricLabel,
  currentLevelHeading,
  nextLevelHeading,
  rows,
  canEdit,
  mentorshipId,
  menteeId,
}: {
  rubricLabel: string;
  currentLevelHeading: string;
  nextLevelHeading: string;
  rows: GrCompetencyRow[];
  canEdit: boolean;
  mentorshipId: string | null;
  menteeId: string;
}) {
  const isLeadership = rubricLabel.toLowerCase().includes("leadership");
  const heading = isLeadership
    ? "Leadership Goals & Rubric"
    : "Goals & Rubric";

  return (
    <div className="overflow-hidden rounded-[12px] border border-line-soft bg-surface">
      <div className="border-b border-line-soft px-5 py-4">
        <h3 className="m-0 text-[15px] font-bold text-ink">{heading}</h3>
        <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
          {rubricLabel}
          {canEdit
            ? " — add specific examples for this person in the last column."
            : " — what is expected at your level, and what promotion looks like."}
        </p>
        <RatingScaleLegend />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="bg-surface-soft">
              <th className="border-b border-line-soft px-4 py-3 align-bottom">
                <span className="block text-[12px] font-bold text-ink">Competency</span>
                <span className="mt-0.5 block text-[11px] font-normal text-ink-muted">
                  What we evaluate
                </span>
              </th>
              <th className="border-b border-line-soft px-4 py-3 align-bottom">
                <span className="block text-[12px] font-bold text-ink">
                  {currentLevelHeading}
                </span>
                <span className="mt-0.5 block text-[11px] font-normal text-ink-muted">
                  What&apos;s expected for this role
                </span>
              </th>
              <th className="border-b border-line-soft px-4 py-3 align-bottom">
                <span className="block text-[12px] font-bold text-ink">
                  {nextLevelHeading}
                </span>
                <span className="mt-0.5 block text-[11px] font-normal text-ink-muted">
                  What&apos;s expected for promotion
                </span>
              </th>
              <th className="border-b border-line-soft px-4 py-3 align-bottom">
                <span className="block text-[12px] font-bold text-ink">
                  Specific examples of this competency for your role
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.competencyId} className="align-top">
                <td className="border-b border-line-soft px-4 py-4">
                  <div className="flex gap-3">
                    <CompetencyIcon index={index} />
                    <div>
                      <p className="m-0 text-[13px] font-bold text-ink">
                        {row.number}. {row.title}
                      </p>
                      <p className="m-0 mt-1 text-[12px] leading-snug text-ink-muted">
                        {row.oneLiner}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="border-b border-line-soft px-4 py-4">
                  <BulletList items={row.currentBullets} />
                </td>
                <td className="border-b border-line-soft px-4 py-4">
                  <BulletList items={row.nextBullets} />
                </td>
                <td className="border-b border-line-soft px-4 py-4">
                  <ExamplesCell
                    row={row}
                    canEdit={canEdit}
                    mentorshipId={mentorshipId}
                    menteeId={menteeId}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
