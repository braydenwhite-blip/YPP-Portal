"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2/button";
import { StatusBadge } from "@/components/ui-v2/status-badge";
import type { WorkflowTemplateDefinition } from "@/lib/workflow-engine/types";
import { duplicateTemplate, setTemplateStatus } from "@/lib/workflow-engine/template-actions";

import { BuilderTab } from "./builder-tab";
import { SettingsTab } from "./tabs/settings-tab";
import { AutomationsTab } from "./tabs/automations-tab";
import { NotificationsTab } from "./tabs/notifications-tab";
import { ExitCriteriaTab } from "./tabs/exit-criteria-tab";
import { VersionsTab } from "./tabs/versions-tab";

type TabKey = "builder" | "settings" | "automations" | "notifications" | "exit-criteria" | "versions";

const TABS: { key: TabKey; label: string }[] = [
  { key: "builder", label: "Builder" },
  { key: "settings", label: "Settings" },
  { key: "automations", label: "Automations" },
  { key: "notifications", label: "Notifications" },
  { key: "exit-criteria", label: "Exit Criteria" },
  { key: "versions", label: "Versions" },
];

export function TemplateBuilder({ template }: { template: WorkflowTemplateDefinition }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("builder");
  const [previewMode, setPreviewMode] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
        setLastSavedAt(Date.now());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const statusTone =
    template.status === "PUBLISHED" ? "success" : template.status === "ARCHIVED" ? "neutral" : "warning";

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div className="rounded-lg border border-danger-100 bg-danger-100 px-4 py-2 text-[13px] text-danger-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusBadge tone={statusTone}>{template.status.toLowerCase()}</StatusBadge>
          <span className="text-[12px] text-ink-muted">v{template.version}</span>
          <span className="text-[12px] text-ink-muted">
            {pending ? "Saving…" : lastSavedAt ? "Saved" : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={previewMode ? "primary" : "secondary"}
            onClick={() => setPreviewMode((v) => !v)}
          >
            {previewMode ? "Exit preview" : "Preview"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
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
          {template.status !== "PUBLISHED" ? (
            <Button
              size="sm"
              loading={pending}
              onClick={() => run(() => setTemplateStatus({ id: template.id, status: "PUBLISHED" }))}
            >
              Publish
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              loading={pending}
              onClick={() => run(() => setTemplateStatus({ id: template.id, status: "DRAFT" }))}
            >
              Unpublish
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={template.status === "ARCHIVED"}
            loading={pending}
            onClick={() => run(() => setTemplateStatus({ id: template.id, status: "ARCHIVED" }))}
          >
            Archive
          </Button>
        </div>
      </div>

      <div className="seg-tabs w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`seg-tab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "builder" ? (
        <BuilderTab template={template} pending={pending} run={run} readOnly={previewMode} />
      ) : null}
      {tab === "settings" ? <SettingsTab template={template} pending={pending} run={run} /> : null}
      {tab === "automations" ? <AutomationsTab template={template} pending={pending} run={run} /> : null}
      {tab === "notifications" ? <NotificationsTab template={template} pending={pending} run={run} /> : null}
      {tab === "exit-criteria" ? <ExitCriteriaTab template={template} pending={pending} run={run} /> : null}
      {tab === "versions" ? <VersionsTab template={template} pending={pending} run={run} /> : null}
    </div>
  );
}
