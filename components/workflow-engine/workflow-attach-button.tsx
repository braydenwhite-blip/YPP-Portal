"use client";

// ============================================================================
// Universal Workflow Engine — "Attach an existing workflow" button
// ============================================================================
//
// A scoped, entity-aware sibling to WorkflowStartButton: instead of starting
// a brand-new instance, this lets a leader link an ALREADY-RUNNING workflow
// instance to another entity it's relevant to (e.g. an Instructor Hiring
// workflow that's also relevant to the specific ClassOffering it's staffing).
// Opens a small ModalV2 with a type-to-search picker
// (listAttachableWorkflowCandidates) and confirms via
// attachWorkflowToEntityAction. Stays on the current page (router.refresh() +
// close) on success, matching WorkflowStartButton's embedded-button pattern.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2/button";
import { ModalV2, ModalFooterV2 } from "@/components/ui-v2/modal";
import {
  attachWorkflowToEntityAction,
  listAttachableWorkflowCandidates,
  type AttachableWorkflowCandidate,
} from "@/lib/workflow-engine/entity-actions";

const field = "w-full rounded-lg border border-line-soft px-3 py-2 text-[14px]";

export function WorkflowAttachButton({
  entityType,
  entityId,
  excludeInstanceId,
}: {
  entityType: string;
  entityId: string;
  excludeInstanceId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AttachableWorkflowCandidate[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchPending, startSearchTransition] = useTransition();
  const [attachPending, startAttachTransition] = useTransition();
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = searchPending || attachPending;

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
    setQuery("");
    setResults([]);
    setSearched(false);
  }

  function runSearch(value: string) {
    setQuery(value);
    setError(null);

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setSearched(false);
      return;
    }

    startSearchTransition(async () => {
      try {
        const candidates = await listAttachableWorkflowCandidates({
          query: trimmed,
          excludeInstanceId,
        });
        setResults(candidates);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not search workflows.");
        setResults([]);
      } finally {
        setSearched(true);
      }
    });
  }

  function attach(instance: AttachableWorkflowCandidate) {
    setError(null);
    setAttachingId(instance.id);
    startAttachTransition(async () => {
      try {
        await attachWorkflowToEntityAction({
          instanceId: instance.id,
          entityType,
          entityId,
        });
        setOpen(false);
        setQuery("");
        setResults([]);
        setSearched(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not attach the workflow.");
      } finally {
        setAttachingId(null);
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Attach a workflow
      </Button>

      <ModalV2 open={open} onClose={close} locked={pending} labelledBy="workflow-attach-heading" size="sm">
        <h2 id="workflow-attach-heading" className="text-[16px] font-bold text-ink">
          Attach an existing workflow
        </h2>
        <p className="text-[13px] text-ink-muted">
          Search for a workflow that&apos;s already running elsewhere and link it here too.
        </p>

        {error ? (
          <div className="rounded-lg border border-danger-100 bg-danger-100 px-3 py-2 text-[13px] text-danger-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <input
            className={field}
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Search workflow title or template…"
            autoFocus
          />
        </div>

        <div className="flex max-h-[280px] flex-col gap-1 overflow-y-auto">
          {searchPending ? (
            <p className="px-1 py-2 text-[13px] text-ink-muted">Searching…</p>
          ) : query.trim().length === 0 ? (
            <p className="px-1 py-2 text-[13px] text-ink-muted">
              Start typing to find a running workflow.
            </p>
          ) : searched && results.length === 0 ? (
            <p className="px-1 py-2 text-[13px] text-ink-muted">No matching workflows found.</p>
          ) : (
            results.map((instance) => (
              <button
                key={instance.id}
                type="button"
                disabled={pending}
                onClick={() => attach(instance)}
                className="flex flex-col items-start gap-0.5 rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:border-brand-400 hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="text-[13.5px] font-semibold text-ink">
                  {attachingId === instance.id ? "Attaching…" : instance.title}
                </span>
                <span className="text-[12px] text-ink-muted">
                  {instance.templateName} · {instance.status}
                </span>
              </button>
            ))
          )}
        </div>

        <ModalFooterV2>
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
        </ModalFooterV2>
      </ModalV2>
    </>
  );
}
