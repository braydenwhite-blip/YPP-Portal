"use client";

import { useMemo, useState } from "react";

import { Button, StatusBadge } from "@/components/ui-v2";
import { FeedbackRequestDrawer } from "@/components/people-strategy/feedback-request-drawer";
import { FeedbackReviewDrawer } from "@/components/people-strategy/feedback-review-drawer";
import { PersonDetailDrawer } from "@/components/people-strategy/person-detail-drawer";
import { PeoplePerformanceTable } from "@/components/people-strategy/people-performance-table";
import {
  buildNeedsActionList,
  deriveNextAction,
  type NextActionKind,
} from "@/lib/people-strategy/people-performance-selectors";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";

/**
 * People & Performance — interactive shell.
 *
 * Owns the three drawers (person detail, feedback request, feedback review) and
 * routes every action — from the needs-action list, a table row, or the detail
 * drawer's main button — through the SAME Next Action helper so the page always
 * suggests one consistent step per person.
 */

type Member = { id: string; name: string };

/** Tones for the needs-action chips — concrete, never a vague level. */
const KIND_TONE: Record<NextActionKind, "danger" | "warning" | "info" | "brand" | "neutral"> = {
  "review-feedback": "info",
  "compile-check-in": "warning",
  "request-feedback": "brand",
  "await-feedback": "info",
  "open-review": "warning",
  "view-overdue": "danger",
  "view-details": "neutral",
};

export function PeoplePerformanceClient({
  rows,
  monthLabel,
  monthShortLabel,
  quarter,
  quarterlyEnabled,
}: {
  rows: PeoplePerformanceRow[];
  monthLabel: string;
  monthShortLabel: string;
  quarter: string;
  quarterlyEnabled: boolean;
}) {
  const [detailRow, setDetailRow] = useState<PeoplePerformanceRow | null>(null);
  const [reviewMember, setReviewMember] = useState<Member | null>(null);
  const [requestMember, setRequestMember] = useState<Member | null>(null);

  const ctx = useMemo(() => ({ monthLabel, quarter }), [monthLabel, quarter]);
  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const needsAction = useMemo(
    () => buildNeedsActionList(rows, ctx),
    [rows, ctx]
  );

  // The one place actions are dispatched — keeps every entry point consistent.
  function runAction(row: PeoplePerformanceRow) {
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

  return (
    <>
      {needsAction.length > 0 ? (
        <section
          aria-label="Needs action"
          className="flex flex-col gap-2 rounded-[12px] border border-line-soft bg-surface p-4 shadow-card"
        >
          <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            Needs action
          </p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {needsAction.map((item) => {
              const row = rowById.get(item.id);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] bg-surface-soft px-3 py-2"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => row && setDetailRow(row)}
                      className="text-[13px] font-semibold text-ink hover:underline"
                    >
                      {item.name}
                    </button>
                    <StatusBadge tone={KIND_TONE[item.action.kind]}>
                      {item.action.reason}
                    </StatusBadge>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => row && runAction(row)}
                  >
                    {item.action.actionLabel}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <PeoplePerformanceTable
        rows={rows}
        monthLabel={monthLabel}
        monthShortLabel={monthShortLabel}
        quarter={quarter}
        quarterlyEnabled={quarterlyEnabled}
        onOpenPerson={setDetailRow}
        onRunAction={runAction}
      />

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
