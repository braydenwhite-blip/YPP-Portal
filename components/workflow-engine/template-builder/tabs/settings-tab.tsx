"use client";

import { CardV2 } from "@/components/ui-v2/card";
import { Button } from "@/components/ui-v2/button";
import { ModalV2 } from "@/components/ui-v2/modal";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { WORKFLOW_DOMAINS, workflowDomainLabel } from "@/lib/workflow-engine/constants";
import type { WorkflowTemplateDefinition } from "@/lib/workflow-engine/types";
import { deleteTemplate, duplicateTemplate, updateTemplate } from "@/lib/workflow-engine/template-actions";
import { useAutosave } from "../use-autosave";

const field = "w-full rounded-lg border border-line-soft px-2.5 py-1.5 text-[13px]";
const labelCls = "text-[11px] font-semibold uppercase tracking-wide text-ink-muted";

type SettingsPatch = {
  name: string;
  description: string;
  domain: string;
  defaultOwnerRole: string;
  defaultOwnerSubtype: string;
  followUpCadenceHours: string;
  escalateAfterHours: string;
};

export function SettingsTab({
  template,
  pending,
  run,
}: {
  template: WorkflowTemplateDefinition;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const autosave = useAutosave<SettingsPatch>(
    {
      name: template.name,
      description: template.description ?? "",
      domain: template.domain ?? "GENERAL",
      defaultOwnerRole: template.defaultOwnerRole ?? "",
      defaultOwnerSubtype: template.defaultOwnerSubtype ?? "",
      followUpCadenceHours: template.followUpCadenceHours != null ? String(template.followUpCadenceHours) : "",
      escalateAfterHours: template.escalateAfterHours != null ? String(template.escalateAfterHours) : "",
    },
    async (v) => {
      await updateTemplate({
        id: template.id,
        name: v.name.trim() || template.name,
        description: v.description,
        domain: v.domain,
        defaultOwnerRole: v.defaultOwnerRole || null,
        defaultOwnerSubtype: v.defaultOwnerSubtype || null,
        followUpCadenceHours: v.followUpCadenceHours ? Number(v.followUpCadenceHours) : null,
        escalateAfterHours: v.escalateAfterHours ? Number(v.escalateAfterHours) : null,
      });
    }
  );

  return (
    <CardV2 padding="lg" className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Name</label>
        <input
          className={field}
          value={autosave.value.name}
          onChange={(e) => autosave.setValue((v) => ({ ...v, name: e.target.value }))}
          onBlur={autosave.flush}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Description</label>
        <textarea
          className={field}
          rows={6}
          value={autosave.value.description}
          onChange={(e) => autosave.setValue((v) => ({ ...v, description: e.target.value }))}
          onBlur={autosave.flush}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Domain</label>
          <select
            className={field}
            value={autosave.value.domain}
            onChange={(e) => {
              autosave.setValue((v) => ({ ...v, domain: e.target.value }));
              autosave.flush();
            }}
          >
            {WORKFLOW_DOMAINS.map((d) => (
              <option key={d} value={d}>
                {workflowDomainLabel(d)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Default owner role</label>
          <input
            className={field}
            value={autosave.value.defaultOwnerRole}
            onChange={(e) => autosave.setValue((v) => ({ ...v, defaultOwnerRole: e.target.value }))}
            onBlur={autosave.flush}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Default owner subtype</label>
          <input
            className={field}
            value={autosave.value.defaultOwnerSubtype}
            onChange={(e) => autosave.setValue((v) => ({ ...v, defaultOwnerSubtype: e.target.value }))}
            onBlur={autosave.flush}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Follow-up cadence (hours)</label>
          <input
            type="number"
            className={field}
            value={autosave.value.followUpCadenceHours}
            onChange={(e) => autosave.setValue((v) => ({ ...v, followUpCadenceHours: e.target.value }))}
            onBlur={autosave.flush}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Escalate after (hours)</label>
          <input
            type="number"
            className={field}
            value={autosave.value.escalateAfterHours}
            onChange={(e) => autosave.setValue((v) => ({ ...v, escalateAfterHours: e.target.value }))}
            onBlur={autosave.flush}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line-soft pt-4">
        <span className="text-[11px] text-ink-muted">
          {autosave.status === "saving" ? "Saving…" : autosave.status === "saved" ? "Saved" : ""}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() =>
              run(async () => {
                const res = await duplicateTemplate({ id: template.id });
                if (res && "id" in res) router.push(`/admin/workflow-templates/${res.id}`);
              })
            }
          >
            Duplicate
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      <ModalV2 open={deleteOpen} onClose={() => setDeleteOpen(false)} labelledBy="delete-template-title" accent="danger">
        <div className="flex flex-col gap-3 p-1">
          <h2 id="delete-template-title" className="text-[15px] font-semibold text-ink">
            Delete this template?
          </h2>
          <p className="text-[13px] text-ink-muted">
            This is permanent. It will fail if the template has running or historical instances —
            archive it instead in that case.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={pending}
              onClick={() => {
                setDeleteOpen(false);
                run(async () => {
                  await deleteTemplate({ id: template.id });
                  router.push("/admin/workflow-templates");
                });
              }}
            >
              Delete template
            </Button>
          </div>
        </div>
      </ModalV2>
    </CardV2>
  );
}
