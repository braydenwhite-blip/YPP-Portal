"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  reviewActionCompletions,
  type ReviewCompletionsResult,
} from "@/lib/people-strategy/action-items-actions";
import type { PendingApprovalQueueItem } from "@/lib/people-strategy/action-approval";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import { Button, ModalFooterV2, ModalV2, cn } from "@/components/ui-v2";

export function ActionApprovalQueue({ items }: { items: PendingApprovalQueueItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(items);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((item) => item.id)));
  const [result, setResult] = useState<ReviewCompletionsResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) return;
    setRemaining(items);
  }, [items, open]);

  const selectedIds = remaining.filter((item) => selected.has(item.id)).map((item) => item.id);
  const selectedCount = selectedIds.length;
  const allSelected = remaining.length > 0 && selectedCount === remaining.length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(remaining.map((item) => item.id)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function review(decision: "approve" | "reject") {
    if (selectedIds.length === 0) return;
    setResult(null);
    startTransition(async () => {
      try {
        const res = await reviewActionCompletions({ ids: selectedIds, decision });
        setResult(res);
        if (res.processed > 0) {
          const done = new Set(selectedIds);
          setRemaining((current) => current.filter((item) => !done.has(item.id)));
          setSelected(new Set());
          router.refresh();
        }
      } catch (error) {
        setResult({
          processed: 0,
          skipped: selectedIds.length,
          errors: [error instanceof Error ? error.message : "Could not update those actions."],
        });
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          setRemaining(items);
          setSelected(new Set(items.map((item) => item.id)));
          setResult(null);
          setOpen(true);
        }}
      >
        Review approvals
        {items.length > 0 ? (
          <span className="ml-1 rounded-full bg-brand-600 px-1.5 py-px text-[11px] font-bold text-white">
            {items.length}
          </span>
        ) : null}
      </Button>
      <ModalV2
        open={open}
        onClose={() => !pending && setOpen(false)}
        locked={pending}
        labelledBy="approval-queue-title"
        size="lg"
        className="max-w-[760px]"
      >
        <div className="flex flex-col gap-4">
          <div>
            <h2 id="approval-queue-title" className="m-0 text-[18px] font-bold text-ink">
              Completions waiting for approval
            </h2>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              Select the actions you want to sign off, then approve or send back.
            </p>
          </div>

          {remaining.length === 0 ? (
            <p className="m-0 rounded-[10px] border border-line-card bg-surface-soft px-3 py-3 text-[13px] text-ink-muted">
              Nothing is waiting for approval.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => (allSelected ? selectNone() : selectAll())}
                  />
                  {allSelected ? "Deselect all" : "Select all"}
                </label>
                <span className="text-[12.5px] text-ink-muted">
                  {selectedCount} of {remaining.length} selected
                </span>
              </div>

              <ul className="m-0 max-h-[min(52vh,420px)] list-none overflow-y-auto rounded-[12px] border border-line-card p-0">
                {remaining.map((item, index) => {
                  const checked = selected.has(item.id);
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "flex items-start gap-3 px-3 py-2.5",
                        index > 0 && "border-t border-line-soft",
                        checked ? "bg-brand-50/60" : "bg-surface"
                      )}
                    >
                      <input
                        id={`approve-${item.id}`}
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={() => toggle(item.id)}
                      />
                      <label htmlFor={`approve-${item.id}`} className="min-w-0 flex-1 cursor-pointer">
                        <span className="block text-[13.5px] font-semibold text-ink">{item.title}</span>
                        <span className="mt-0.5 block text-[12px] text-ink-muted">
                          {item.leadName}
                          {" · "}
                          {item.department}
                          {item.chapter ? ` · ${item.chapter}` : ""}
                          {item.submittedAt
                            ? ` · submitted ${formatMonthDay(new Date(item.submittedAt))}`
                            : ""}
                        </span>
                      </label>
                      <Link
                        href={`/actions/${item.id}`}
                        className="shrink-0 pt-0.5 text-[12px] font-semibold text-brand-700 no-underline hover:underline"
                        onClick={() => setOpen(false)}
                      >
                        Open
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {result ? (
            <div className="rounded-[10px] border border-line-card bg-surface-soft px-3 py-2 text-[13px] text-ink">
              <p className="m-0 font-semibold">
                Updated {result.processed}
                {result.skipped ? ` · skipped ${result.skipped}` : ""}
              </p>
              {result.errors.length > 0 ? (
                <ul className="mb-0 mt-2 list-disc pl-4 text-[12.5px] text-ink-muted">
                  {result.errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <ModalFooterV2 className="justify-between">
            <Button type="button" variant="secondary" size="md" onClick={() => setOpen(false)}>
              {remaining.length === 0 && result ? "Done" : "Close"}
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                loading={pending}
                disabled={selectedCount === 0}
                onClick={() => review("reject")}
              >
                Send back selected
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={pending}
                disabled={selectedCount === 0}
                onClick={() => review("approve")}
              >
                Approve selected
              </Button>
            </div>
          </ModalFooterV2>
        </div>
      </ModalV2>
    </>
  );
}
