"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui-v2/button";
import { CardV2 } from "@/components/ui-v2/card";
import type { WorkflowTemplateDefinition } from "@/lib/workflow-engine/types";
import {
  getTemplateVersionSnapshot,
  listTemplateVersions,
  restoreTemplateVersionAsDraft,
} from "@/lib/workflow-engine/template-actions";
import { BuilderTab } from "../builder-tab";

type VersionSummary = {
  id: string;
  version: number;
  publishedAt: string | Date;
  publishedById: string | null;
};

export function VersionsTab({
  template,
  pending,
  run,
}: {
  template: WorkflowTemplateDefinition;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [viewing, setViewing] = useState<WorkflowTemplateDefinition | null>(null);
  const [loadingView, setLoadingView] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listTemplateVersions({ templateId: template.id }).then((res) => {
      if (!cancelled) setVersions(res as VersionSummary[]);
    });
    return () => {
      cancelled = true;
    };
  }, [template.id]);

  if (viewing) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink">
            Version {(viewing as { version?: number }).version ?? ""} (read-only)
          </p>
          <Button size="sm" variant="ghost" onClick={() => setViewing(null)}>
            ← Back to versions list
          </Button>
        </div>
        <BuilderTab template={viewing} pending={false} run={() => {}} readOnly />
      </div>
    );
  }

  return (
    <CardV2 padding="lg" className="flex flex-col gap-3">
      <p className="text-[12px] text-ink-muted">
        A snapshot is captured every time this template is published. View any version, or restore
        one as the current draft — restoring never changes a live published template directly, and
        is itself reversible by restoring another version.
      </p>
      <ul className="flex flex-col gap-2">
        {(versions ?? []).map((v) => (
          <li
            key={v.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-line-soft px-3 py-2"
          >
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-ink">Version {v.version}</span>
              <span className="text-[11px] text-ink-muted">
                {new Date(v.publishedAt).toLocaleString()}
                {v.publishedById ? ` · ${v.publishedById.slice(0, 8)}` : ""}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                loading={loadingView}
                onClick={async () => {
                  setLoadingView(true);
                  const res = await getTemplateVersionSnapshot({ id: v.id });
                  setLoadingView(false);
                  setViewing(res.snapshot);
                }}
              >
                View
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() => {
                  if (
                    confirm(
                      `Restore version ${v.version} as the current draft? This overwrites the current draft content (you can restore another version afterward if needed).`
                    )
                  ) {
                    run(() => restoreTemplateVersionAsDraft({ versionId: v.id }));
                  }
                }}
              >
                Restore as draft
              </Button>
            </div>
          </li>
        ))}
        {versions !== null && versions.length === 0 ? (
          <li className="text-[12px] text-ink-muted">No versions yet — publish this template to capture one.</li>
        ) : null}
        {versions === null ? <li className="text-[12px] text-ink-muted">Loading…</li> : null}
      </ul>
    </CardV2>
  );
}
