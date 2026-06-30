"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2/button";
import { CardV2 } from "@/components/ui-v2/card";
import { startWorkflow } from "@/lib/workflow-engine/instance-actions";
import type { TemplateSummary } from "@/lib/workflow-engine/queries";

const field = "w-full rounded-lg border border-line-soft px-3 py-2 text-[14px]";
const label = "text-[12px] font-semibold text-ink-muted";

export function StartWorkflowForm({ templates }: { templates: TemplateSummary[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");

  const selected = templates.find((t) => t.id === templateId);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = (await startWorkflow({
          templateId,
          title: title || null,
          dueAt: dueAt || null,
        })) as { id: string };
        router.push(`/workflows/${res.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start the workflow.");
      }
    });
  }

  if (templates.length === 0) {
    return (
      <CardV2 padding="lg">
        <p className="text-[14px] text-ink-muted">
          No published templates yet. Publish a template in{" "}
          <a className="text-brand-700 underline" href="/admin/workflow-templates">
            Workflow Templates
          </a>{" "}
          first.
        </p>
      </CardV2>
    );
  }

  return (
    <CardV2 padding="lg" className="flex max-w-xl flex-col gap-4">
      {error ? (
        <div className="rounded-lg border border-danger-100 bg-danger-100 px-3 py-2 text-[13px] text-danger-700">
          {error}
        </div>
      ) : null}

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

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button loading={pending} onClick={submit} disabled={!templateId}>
          Start workflow
        </Button>
      </div>
    </CardV2>
  );
}
