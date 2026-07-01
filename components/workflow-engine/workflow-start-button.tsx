"use client";

// ============================================================================
// Universal Workflow Engine — embeddable "Start workflow" launch button
// ============================================================================
//
// A scoped, entity-aware sibling to StartWorkflowForm (the dedicated
// full-page /workflows/new route): a Button that opens a ModalV2 with a
// template picker + launch preview, and confirms via startWorkflowForEntity.
// Unlike the full-page form, on success we stay on the current entity page
// (router.refresh() + close) rather than navigating to /workflows/[id] —
// the whole point of an embedded button is to see the freshly-attached
// workflow's "next step" surface immediately on the page you're already on.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2/button";
import { ModalV2, ModalFooterV2 } from "@/components/ui-v2/modal";
import { getTemplatePreview, startWorkflowForEntity } from "@/lib/workflow-engine/entity-actions";
import type { LaunchPreview } from "@/lib/workflow-engine/launch-center";

const field = "w-full rounded-lg border border-line-soft px-3 py-2 text-[14px]";
const label = "text-[12px] font-semibold text-ink-muted";

export type StartableTemplate = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  domainLabel: string;
};

export function WorkflowStartButton({
  entityType,
  entityId,
  templates,
  chapterId,
}: {
  entityType: string;
  entityId: string;
  templates: StartableTemplate[];
  chapterId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [previewPending, startPreviewTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [preview, setPreview] = useState<LaunchPreview | null>(null);

  const selected = templates.find((t) => t.id === templateId);

  useEffect(() => {
    if (!open || !templateId) {
      setPreview(null);
      return;
    }
    setPreview(null);
    startPreviewTransition(async () => {
      try {
        const result = await getTemplatePreview({ id: templateId });
        setPreview(result);
      } catch {
        setPreview(null);
      }
    });
  }, [open, templateId]);

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await startWorkflowForEntity({
          templateId,
          entityType,
          entityId,
          title: title || null,
          dueAt: dueAt || null,
          chapterId: chapterId || null,
        });
        setOpen(false);
        setTitle("");
        setDueAt("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start the workflow.");
      }
    });
  }

  return (
    <>
      <Button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Start workflow
      </Button>

      <ModalV2 open={open} onClose={close} locked={pending} labelledBy="workflow-start-heading" size="lg">
        <h2 id="workflow-start-heading" className="text-[16px] font-bold text-ink">
          Start a workflow
        </h2>

        {error ? (
          <div className="rounded-lg border border-danger-100 bg-danger-100 px-3 py-2 text-[13px] text-danger-700">
            {error}
          </div>
        ) : null}

        {templates.length === 0 ? (
          <p className="text-[14px] text-ink-muted">
            No published templates yet. Publish a template in{" "}
            <a className="text-brand-700 underline" href="/admin/workflow-templates">
              Workflow Templates
            </a>{" "}
            first.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={label}>Template</label>
              <select
                className={field}
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.domainLabel}
                  </option>
                ))}
              </select>
              {selected?.description ? (
                <p className="text-[12px] text-ink-muted">{selected.description}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={label}>Title (optional)</label>
              <input
                className={field}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={selected?.name ?? "Workflow title"}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={label}>Due date (optional)</label>
              <input
                type="date"
                className={field}
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>

            <LaunchPreviewPanel loading={previewPending} preview={preview} />
          </div>
        )}

        <ModalFooterV2>
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button
            loading={pending}
            onClick={submit}
            disabled={!templateId || templates.length === 0}
          >
            Confirm
          </Button>
        </ModalFooterV2>
      </ModalV2>
    </>
  );
}

function LaunchPreviewPanel({
  loading,
  preview,
}: {
  loading: boolean;
  preview: LaunchPreview | null;
}) {
  if (loading) {
    return (
      <div className="rounded-lg bg-brand-50/60 px-4 py-3 text-[13px] text-ink-muted">
        Loading preview…
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-brand-50/60 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        What happens when you start this
      </p>
      <p className="text-[13px] text-ink">
        {preview.stageCount} stage{preview.stageCount === 1 ? "" : "s"} · starts at{" "}
        <span className="font-medium">{preview.firstStageName}</span>
      </p>
      {preview.firstStepNames.length > 0 ? (
        <ul className="ml-4 list-disc text-[12px] text-ink-muted">
          {preview.firstStepNames.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-[12px] text-ink-muted">
        ~{preview.estimatedActionsCount} action{preview.estimatedActionsCount === 1 ? "" : "s"} will
        be created · ~{preview.estimatedMeetingsCount} meeting
        {preview.estimatedMeetingsCount === 1 ? "" : "s"} will be scheduled
      </p>
      {preview.hasEscalation ? (
        <p className="text-[12px] font-medium text-warning-700">
          This workflow can auto-escalate if a step stalls.
        </p>
      ) : null}
    </div>
  );
}
