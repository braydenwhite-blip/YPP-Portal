"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  Button,
  ModalFooterV2,
  ModalV2,
  TableCell,
  TableHeadCell,
  TableV2,
} from "@/components/ui-v2";
import { deleteMenteeHomeDocuments } from "@/lib/mentorship/mentee-home-document-actions";
import type {
  MenteeHomeDocument,
  MenteeHomeProcessStep,
} from "@/lib/mentorship/mentee-home-documents";

function ProcessStepper({ steps }: { steps: MenteeHomeProcessStep[] }) {
  return (
    <ol className="m-0 flex min-w-[220px] list-none items-start gap-0 p-0">
      {steps.map((step, index) => {
        const complete = step.state === "complete";
        const current = step.state === "current" || step.state === "due";
        const warn = step.state === "due";
        return (
          <li key={step.id} className="flex min-w-0 flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              {index > 0 ? (
                <span
                  aria-hidden
                  className={[
                    "h-0.5 flex-1",
                    steps[index - 1]?.state === "complete" ? "bg-green-500" : "border-t border-dashed border-line",
                  ].join(" ")}
                />
              ) : (
                <span className="flex-1" />
              )}
              <span
                className={[
                  "relative z-[1] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                  complete
                    ? "border-green-500 bg-green-500 text-white"
                    : current
                      ? warn
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-brand-600 bg-brand-600 text-white"
                      : "border-line bg-white text-transparent",
                ].join(" ")}
                title={step.label}
              >
                {complete ? "✓" : ""}
              </span>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={[
                    "h-0.5 flex-1",
                    complete ? "bg-green-500" : "border-t border-dashed border-line",
                  ].join(" ")}
                />
              ) : (
                <span className="flex-1" />
              )}
            </div>
            <p className="m-0 mt-1.5 line-clamp-2 px-0.5 text-[10px] font-medium leading-tight text-ink-muted">
              {step.label}
            </p>
            {step.dateLabel ? (
              <p className="m-0 mt-0.5 text-[10px] text-ink-muted">{step.dateLabel}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function TypeBadge({ kind, label }: { kind: MenteeHomeDocument["kind"]; label: string }) {
  const classes =
    kind === "gr"
      ? "bg-sky-50 text-sky-800 ring-sky-200"
      : "bg-brand-50 text-brand-800 ring-brand-200";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${classes}`}
    >
      {label}
    </span>
  );
}

/**
 * Reviews & Documents table with optional multi-select delete for mentors/admins.
 */
export function MenteeHomeDocumentsTable({
  menteeId,
  documents,
  canManage,
  toolbar,
}: {
  menteeId: string;
  documents: MenteeHomeDocument[];
  canManage: boolean;
  /** Extra header actions (e.g. New Review) rendered beside delete. */
  toolbar?: ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectedDocs = useMemo(
    () => documents.filter((d) => selected.has(d.id)),
    [documents, selected],
  );
  const allSelected =
    documents.length > 0 && documents.every((d) => selected.has(d.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (documents.every((d) => prev.has(d.id))) return new Set();
      return new Set(documents.map((d) => d.id));
    });
  }

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteMenteeHomeDocuments({
          menteeId,
          items: selectedDocs.map((d) => ({ id: d.id })),
        });
        setSelected(new Set());
        setConfirmOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete documents.");
      }
    });
  }

  const hasGr = selectedDocs.some((d) => d.kind === "gr");
  const hasReview = selectedDocs.some((d) => d.kind === "performance_review");

  return (
    <>
      {(canManage || toolbar) && documents.length > 0 ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {canManage ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={toggleAll}
                >
                  {allSelected ? "Clear selection" : "Select all"}
                </Button>
                {selected.size > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="border-danger-300 text-danger-800 hover:border-danger-400 hover:bg-danger-50"
                    onClick={() => {
                      setError(null);
                      setConfirmOpen(true);
                    }}
                  >
                    Delete ({selected.size})
                  </Button>
                ) : (
                  <span className="text-[12.5px] text-ink-muted">
                    Select documents to delete
                  </span>
                )}
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">{toolbar}</div>
        </div>
      ) : toolbar ? (
        <div className="flex w-full flex-wrap items-center justify-end gap-3 border-b border-line-soft px-5 py-3">
          {toolbar}
        </div>
      ) : null}

      <TableV2>
        <thead>
          <tr>
            {canManage ? (
              <TableHeadCell className="w-10">
                <input
                  type="checkbox"
                  className="size-4 accent-brand-600"
                  checked={allSelected}
                  aria-label="Select all documents"
                  onChange={toggleAll}
                />
              </TableHeadCell>
            ) : null}
            <TableHeadCell>Document</TableHeadCell>
            <TableHeadCell className="hidden md:table-cell">Cycle / Period</TableHeadCell>
            <TableHeadCell>Type</TableHeadCell>
            <TableHeadCell className="hidden lg:table-cell">Last Updated</TableHeadCell>
            <TableHeadCell className="hidden sm:table-cell">Review Process</TableHeadCell>
            <TableHeadCell className="text-right"> </TableHeadCell>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const isSelected = selected.has(doc.id);
            return (
              <tr
                key={doc.id}
                className={[
                  "align-top",
                  isSelected ? "bg-brand-50/40" : "",
                ].join(" ")}
              >
                {canManage ? (
                  <TableCell>
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-brand-600"
                      checked={isSelected}
                      aria-label={`Select ${doc.title}`}
                      onChange={() => toggle(doc.id)}
                    />
                  </TableCell>
                ) : null}
                <TableCell>
                  <p className="m-0 text-[13.5px] font-semibold text-ink">{doc.title}</p>
                  <p className="m-0 mt-0.5 text-[12px] text-ink-muted">{doc.periodLabel}</p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <p className="m-0 text-[13px] text-ink">{doc.cycleLabel}</p>
                </TableCell>
                <TableCell>
                  <TypeBadge kind={doc.kind} label={doc.typeLabel} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <p className="m-0 text-[13px] text-ink">{doc.updatedAtLabel}</p>
                  {doc.updatedBy ? (
                    <p className="m-0 mt-0.5 text-[12px] text-ink-muted">
                      by {doc.updatedBy}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <ProcessStepper steps={doc.steps} />
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={doc.href}
                    className={[
                      "inline-flex min-h-8 items-center justify-center rounded-full px-3.5 text-[12.5px] font-semibold no-underline",
                      doc.actionVariant === "primary"
                        ? "bg-brand-600 text-white hover:brightness-95"
                        : "border border-brand-300 bg-white text-brand-700 hover:bg-brand-50",
                    ].join(" ")}
                  >
                    {doc.actionLabel}
                  </Link>
                </TableCell>
              </tr>
            );
          })}
        </tbody>
      </TableV2>

      <ModalV2
        open={confirmOpen}
        onClose={() => {
          if (!pending) setConfirmOpen(false);
        }}
        labelledBy="delete-docs-title"
        locked={pending}
        size="md"
        accent="danger"
        role="alertdialog"
      >
        <div className="flex flex-col gap-3">
          <h2
            id="delete-docs-title"
            className="m-0 text-[17px] font-semibold text-ink"
          >
            Delete {selectedDocs.length} document
            {selectedDocs.length === 1 ? "" : "s"}?
          </h2>
          <div className="rounded-[10px] border border-danger-200 bg-danger-50/70 px-3.5 py-3 text-[13.5px] leading-relaxed text-danger-900">
            <p className="m-0 font-semibold">This cannot be undone.</p>
            <p className="m-0 mt-1.5">
              {hasReview
                ? "Performance reviews, ratings, and linked reflections will be permanently removed. "
                : null}
              {hasGr
                ? "G&R documents and their goals will be permanently removed. "
                : null}
              The mentee will no longer see these in their table.
            </p>
          </div>
          <ul className="m-0 max-h-[180px] list-disc space-y-1 overflow-y-auto pl-5 text-[13.5px] text-ink">
            {selectedDocs.map((doc) => (
              <li key={doc.id}>
                <span className="font-medium">{doc.title}</span>
                <span className="text-ink-muted"> · {doc.typeLabel}</span>
              </li>
            ))}
          </ul>
          {error ? (
            <p className="m-0 text-[12.5px] font-medium text-danger-700">{error}</p>
          ) : null}
        </div>
        <ModalFooterV2>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setConfirmOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            className="!bg-danger-700 hover:!brightness-95"
            onClick={confirmDelete}
          >
            Delete permanently
          </Button>
        </ModalFooterV2>
      </ModalV2>
    </>
  );
}
