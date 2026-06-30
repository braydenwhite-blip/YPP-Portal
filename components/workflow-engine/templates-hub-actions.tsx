"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2/button";
import { createTemplate, installBlueprint } from "@/lib/workflow-engine/template-actions";

export type BlueprintOption = { key: string; name: string; domainLabel: string };

export function TemplatesHubActions({ blueprints }: { blueprints: BlueprintOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showInstall, setShowInstall] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function newTemplate() {
    const name = prompt("Name your workflow template");
    if (!name) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = (await createTemplate({ name })) as { id: string };
        router.push(`/admin/workflow-templates/${res.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create template.");
      }
    });
  }

  function install(key: string) {
    setError(null);
    startTransition(async () => {
      try {
        const res = (await installBlueprint({ blueprintKey: key })) as { id: string };
        setShowInstall(false);
        router.push(`/admin/workflow-templates/${res.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not install blueprint.");
      }
    });
  }

  return (
    <div className="relative flex items-center gap-2">
      {error ? <span className="text-[12px] text-danger-700">{error}</span> : null}
      <Button variant="secondary" size="sm" onClick={() => setShowInstall((v) => !v)}>
        Install blueprint
      </Button>
      <Button size="sm" loading={pending} onClick={newTemplate}>
        New template
      </Button>

      {showInstall ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-line-card bg-surface p-2 shadow-lg">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Reusable process blueprints
          </p>
          <ul className="max-h-80 overflow-auto">
            {blueprints.map((b) => (
              <li key={b.key}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => install(b.key)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-brand-50"
                >
                  <span className="text-ink">{b.name}</span>
                  <span className="text-[11px] text-ink-muted">{b.domainLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
