"use client";

import { useMemo, useState, type ReactNode } from "react";

import { FeedbackRequestDrawer } from "@/components/people-strategy/feedback-request-drawer";
import { FeedbackReviewDrawer } from "@/components/people-strategy/feedback-review-drawer";
import { PeopleCockpitView } from "@/components/people-strategy/people-cockpit";
import { PersonDetailDrawer } from "@/components/people-strategy/person-detail-drawer";
import { PeoplePerformanceTable } from "@/components/people-strategy/people-performance-table";
import { deriveNextAction } from "@/lib/people-strategy/people-performance-selectors";
import type { CockpitItem, PeopleCockpit } from "@/lib/people-strategy/people-cockpit";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";

/**
 * People & Performance — interactive shell (the cockpit host).
 *
 * Renders the guided decision-lane cockpit as the primary view and owns the
 * three drawers (person detail, feedback request, feedback review). Every person
 * action — from a cockpit card or the detail drawer's main button — routes
 * through the SAME Next Action helper so the page always suggests one consistent
 * step per person. The full roster table is demoted behind a disclosure for
 * power users who want to look someone up.
 */

type Member = { id: string; name: string };

export function PeoplePerformanceClient({
  cockpit,
  rows,
  tableRows,
  browseControls,
  monthLabel,
  monthShortLabel,
  quarter,
  quarterlyEnabled,
}: {
  cockpit: PeopleCockpit;
  /** All performance rows — the cockpit's person cards resolve against these. */
  rows: PeoplePerformanceRow[];
  /** The (search/filter-narrowed) rows shown in the Browse-all table. */
  tableRows: PeoplePerformanceRow[];
  /** Server-rendered search + filter controls, shown inside the Browse-all zone. */
  browseControls?: ReactNode;
  monthLabel: string;
  monthShortLabel: string;
  quarter: string;
  quarterlyEnabled: boolean;
}) {
  const [detailRow, setDetailRow] = useState<PeoplePerformanceRow | null>(null);
  const [reviewMember, setReviewMember] = useState<Member | null>(null);
  const [requestMember, setRequestMember] = useState<Member | null>(null);
  const [showTable, setShowTable] = useState(false);

  const ctx = useMemo(() => ({ monthLabel, quarter }), [monthLabel, quarter]);
  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  function openPerson(personId: string) {
    const row = rowById.get(personId);
    if (row) setDetailRow(row);
  }

  // The one place an action is dispatched — keeps the cockpit cards, the table
  // rows, and the detail drawer consistent with the Next Action helper.
  function dispatchRow(row: PeoplePerformanceRow) {
    const action = deriveNextAction(row.facts, ctx);
    const member = { id: row.id, name: row.name || row.email };
    switch (action.kind) {
      case "review-feedback":
      case "await-feedback":
        setReviewMember(member);
        break;
      case "request-feedback":
        setRequestMember(member);
        break;
      default:
        setDetailRow(row);
        break;
    }
  }

  function runPersonAction(item: CockpitItem) {
    if (!item.person.id) return;
    const row = rowById.get(item.person.id);
    if (row) dispatchRow(row);
  }

  return (
    <>
      <PeopleCockpitView
        cockpit={cockpit}
        onOpenPerson={openPerson}
        onRunPersonAction={runPersonAction}
      />

      <div className="flex flex-col gap-3 border-t border-line-soft pt-4">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          className="self-start text-[12.5px] font-semibold text-brand-700 hover:underline"
        >
          {showTable
            ? "Hide the full team directory"
            : `Browse the full team directory (${rows.length})`}
        </button>
        {showTable ? (
          <>
            {browseControls}
            {tableRows.length > 0 ? (
              <PeoplePerformanceTable
                rows={tableRows}
                monthLabel={monthLabel}
                monthShortLabel={monthShortLabel}
                quarter={quarter}
                quarterlyEnabled={quarterlyEnabled}
                onOpenPerson={setDetailRow}
                onRunAction={dispatchRow}
              />
            ) : (
              <p className="m-0 text-[13px] text-ink-muted">
                No one matches this search or filter.
              </p>
            )}
          </>
        ) : null}
      </div>

      <PersonDetailDrawer
        row={detailRow}
        monthLabel={monthLabel}
        monthShortLabel={monthShortLabel}
        quarter={quarter}
        quarterlyEnabled={quarterlyEnabled}
        onClose={() => setDetailRow(null)}
        onReviewFeedback={setReviewMember}
        onRequestFeedback={setRequestMember}
      />

      <FeedbackReviewDrawer member={reviewMember} onClose={() => setReviewMember(null)} />
      <FeedbackRequestDrawer member={requestMember} onClose={() => setRequestMember(null)} />
    </>
  );
}
