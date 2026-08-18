"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui-v2";
import { repairChapterDataIssue } from "@/lib/chapters/actions";
import type { ChapterIntegrityIssue } from "@/lib/chapters/integrity";

/**
 * Quiet punch-list for chapter data gaps. Collapsed by default so it doesn't
 * dominate Chapter Command — open only when someone is ready to fix things.
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
    <details className="group rounded-[14px] border border-line-card bg-surface shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13.5px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span>
          Things to fix
          <span className="ml-2 rounded-md bg-progress-50 px-1.5 py-0.5 text-[11.5px] font-bold text-progress-700">
            {issues.length}
          </span>
        </span>
        <span className="text-[12px] font-medium text-ink-muted group-open:hidden">Show</span>
        <span className="hidden text-[12px] font-medium text-ink-muted group-open:inline">Hide</span>
      </summary>

      <div className="border-t border-line-soft px-4 py-3">
        {error ? <p className="m-0 mb-2 text-[12.5px] text-danger-700">{error}</p> : null}
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {issues.map((issue) => {
            const key = `${issue.kind}:${issue.refId}`;
            return (
              <li
                key={key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-soft px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="m-0 text-[13px] font-semibold text-ink">{issue.title}</p>
                  <p className="m-0 mt-0.5 text-[12px] text-ink-muted">{issue.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {issue.repairable ? (
                    <Button
                      type="button"
                      variant="secondary"
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
                    Open
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
