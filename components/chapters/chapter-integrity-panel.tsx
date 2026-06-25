"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, StatusBadge } from "@/components/ui-v2";
import { repairChapterDataIssue } from "@/lib/chapters/actions";
import type { ChapterIntegrityIssue } from "@/lib/chapters/integrity";

/**
 * Compact "needs repair" list for the chapter command page. Only renders when
 * there are real data-integrity issues; each row links to where a human fixes
 * it, and the safe ones (approved-app-with-no-chapter, support-request-with-no-
 * action) get a one-click Fix that does the repair server-side. Not a dashboard
 * — a punch list that empties itself.
 */
export function ChapterIntegrityPanel({ issues }: { issues: ChapterIntegrityIssue[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);

  if (issues.length === 0) return null;

  function fix(issue: ChapterIntegrityIssue) {
    if (issue.kind !== "approved_app_no_chapter" && issue.kind !== "support_no_action") return;
    setError(null);
    setFixing(`${issue.kind}:${issue.refId}`);
    startTransition(async () => {
      try {
        await repairChapterDataIssue({ kind: issue.kind, refId: issue.refId });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not repair.");
      } finally {
        setFixing(null);
      }
    });
  }

  return (
    <section className="rounded-[14px] border border-amber-300/60 bg-amber-50/60 p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="m-0 text-[14px] font-bold text-ink">
          Chapter data needs attention
          <span className="ml-2 text-[12px] font-medium text-ink-muted">{issues.length}</span>
        </h2>
      </div>

      {error ? <p className="m-0 mb-2 text-[12.5px] text-danger-700">{error}</p> : null}

      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {issues.map((issue) => {
          const key = `${issue.kind}:${issue.refId}`;
          return (
            <li
              key={key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-line-soft bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusBadge tone={issue.severity === "danger" ? "danger" : "warning"}>
                    {issue.severity === "danger" ? "Fix" : "Review"}
                  </StatusBadge>
                  <span className="text-[13px] font-semibold text-ink">{issue.title}</span>
                </div>
                <p className="m-0 mt-0.5 text-[12px] text-ink-muted">{issue.detail}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {issue.repairable ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={pending && fixing === key}
                    onClick={() => fix(issue)}
                  >
                    Fix
                  </Button>
                ) : null}
                <Link
                  href={issue.href}
                  className="text-[12.5px] font-semibold text-brand-700 no-underline hover:underline"
                >
                  Review →
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
