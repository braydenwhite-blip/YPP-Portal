"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

import { Button, ModalFooterV2, ModalV2 } from "@/components/ui-v2";
import {
  archiveMetricsTrackerMetric,
  upsertMetricsTrackerMetric,
} from "@/lib/chapters/metrics-tracker/actions";
import {
  categoriesForScope,
  type ChartKind,
  type MetricReset,
  type MetricsScope,
} from "@/lib/chapters/metrics-tracker/catalog";
import type { EditableMetricSnapshot } from "@/lib/chapters/metrics-tracker/catalog";

export type MetricEditorState =
  | { mode: "create"; scope: MetricsScope; categoryId: string }
  | { mode: "edit"; scope: MetricsScope; categoryId: string; metric: EditableMetricSnapshot };

type FormState = {
  label: string;
  owner: string;
  targetLabel: string;
  reset: MetricReset;
  unit: "count" | "percent" | "currency" | "hours" | "text";
  chart: ChartKind;
  tracks: string;
  why: string;
  noTarget: boolean;
  categoryId: string;
  monthlyTargets: Array<string>;
  targetDisplay: Array<string>;
};

const MONTHS = ["M1", "M2", "M3", "M4", "M5", "M6"] as const;

function numOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t || t === "—" || /^no target$/i.test(t) || t.toLowerCase() === "x") return null;
  const n = Number(t.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function initialForm(state: MetricEditorState): FormState {
  if (state.mode === "edit") {
    const m = state.metric.def;
    return {
      label: m.label,
      owner: m.owner,
      targetLabel: m.targetLabel,
      reset: m.reset,
      unit: m.unit,
      chart: m.chart,
      tracks: m.tracks ?? "",
      why: m.why ?? "",
      noTarget: Boolean(m.noTarget),
      categoryId: state.categoryId,
      monthlyTargets: m.monthlyTargets.map((v) => (v == null ? "" : String(v))),
      targetDisplay: (m.targetDisplay ?? m.monthlyTargets).map((v) =>
        v == null ? "" : String(v)
      ),
    };
  }
  return {
    label: "",
    owner: "",
    targetLabel: "",
    reset: "monthly",
    unit: "count",
    chart: "line",
    tracks: "",
    why: "",
    noTarget: false,
    categoryId: state.categoryId,
    monthlyTargets: ["", "", "", "", "", ""],
    targetDisplay: ["", "", "", "", "", ""],
  };
}

const fieldClass =
  "mt-1 w-full rounded-lg border border-line-card bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100";

export function MetricEditorModal({
  state,
  onClose,
}: {
  state: MetricEditorState | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (state) {
      setForm(initialForm(state));
      setError(null);
    } else {
      setForm(null);
      setError(null);
    }
  }, [state]);

  const open = Boolean(state);
  const activeForm = form;
  const categories = state ? categoriesForScope(state.scope) : [];

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function setMonth(index: number, field: "monthlyTargets" | "targetDisplay", value: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const arr = [...prev[field]];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  }

  function save() {
    if (!state || !activeForm) return;
    setError(null);
    startTransition(async () => {
      const monthlyTargets = activeForm.noTarget
        ? [null, null, null, null, null, null]
        : activeForm.monthlyTargets.map(numOrNull);

      const targetDisplay = activeForm.targetDisplay.map((v) => {
        const t = v.trim();
        return t ? t : null;
      });

      const res = await upsertMetricsTrackerMetric({
        id: state.mode === "edit" ? state.metric.rowId : undefined,
        scope: state.scope,
        categoryId: activeForm.categoryId,
        label: activeForm.label,
        owner: activeForm.owner,
        targetLabel: activeForm.targetLabel,
        reset: activeForm.reset,
        unit: activeForm.unit,
        chart: activeForm.chart,
        tracks: activeForm.tracks || null,
        why: activeForm.why || null,
        noTarget: activeForm.noTarget,
        monthlyTargets,
        targetDisplay,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  function remove() {
    if (!state || state.mode !== "edit") return;
    if (!window.confirm("Remove this metric from the tracker?")) return;
    setError(null);
    startTransition(async () => {
      const res = await archiveMetricsTrackerMetric({ id: state.metric.rowId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <ModalV2
      open={open}
      onClose={() => {
        if (pending) return;
        onClose();
      }}
      labelledBy={titleId}
      size="lg"
      locked={pending}
      className="max-w-[720px]"
    >
      {activeForm && state ? (
        <div className="flex max-h-[min(82vh,720px)] flex-col gap-3 overflow-y-auto">
          <div>
            <h2 id={titleId} className="m-0 text-[18px] font-bold text-ink">
              {state.mode === "edit" ? "Edit metric" : "Add metric"}
            </h2>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              Admins only. Edit owners, targets, and M1–M6 goals.
            </p>
          </div>

          <label className="block text-[12px] font-semibold text-ink-muted">
            Category
            <select
              className={fieldClass}
              value={activeForm.categoryId}
              disabled={state.mode === "edit" || pending}
              onChange={(e) => set("categoryId", e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[12px] font-semibold text-ink-muted">
            Action / metric name
            <input
              className={fieldClass}
              value={activeForm.label}
              disabled={pending}
              onChange={(e) => set("label", e.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[12px] font-semibold text-ink-muted">
              Owner
              <input
                className={fieldClass}
                value={activeForm.owner}
                disabled={pending}
                onChange={(e) => set("owner", e.target.value)}
              />
            </label>
            <label className="block text-[12px] font-semibold text-ink-muted">
              Target (summary)
              <input
                className={fieldClass}
                value={activeForm.targetLabel}
                disabled={pending}
                onChange={(e) => set("targetLabel", e.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-[12px] font-semibold text-ink-muted">
              Resets
              <select
                className={fieldClass}
                value={activeForm.reset}
                disabled={pending}
                onChange={(e) => set("reset", e.target.value as MetricReset)}
              >
                <option value="monthly">Monthly</option>
                <option value="cumulative">Lifetime / cumulative</option>
              </select>
            </label>
            <label className="block text-[12px] font-semibold text-ink-muted">
              Unit
              <select
                className={fieldClass}
                value={activeForm.unit}
                disabled={pending}
                onChange={(e) => set("unit", e.target.value as FormState["unit"])}
              >
                <option value="count">Count</option>
                <option value="percent">Percent</option>
                <option value="currency">Currency</option>
                <option value="hours">Hours</option>
                <option value="text">Text</option>
              </select>
            </label>
            <label className="block text-[12px] font-semibold text-ink-muted">
              Chart
              <select
                className={fieldClass}
                value={activeForm.chart}
                disabled={pending}
                onChange={(e) => set("chart", e.target.value as ChartKind)}
              >
                <option value="line">Line</option>
                <option value="bar">Bar</option>
                <option value="area">Area</option>
                <option value="scatter">Scatter</option>
              </select>
            </label>
          </div>

          <label className="block text-[12px] font-semibold text-ink-muted">
            What it tracks
            <textarea
              className={`${fieldClass} min-h-[56px] resize-y`}
              value={activeForm.tracks}
              disabled={pending}
              onChange={(e) => set("tracks", e.target.value)}
            />
          </label>

          <label className="block text-[12px] font-semibold text-ink-muted">
            Why it matters
            <textarea
              className={`${fieldClass} min-h-[56px] resize-y`}
              value={activeForm.why}
              disabled={pending}
              onChange={(e) => set("why", e.target.value)}
            />
          </label>

          {!activeForm.noTarget ? (
            <div className="rounded-[12px] border border-line-card bg-surface-soft p-3">
              <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
                M1–M6 targets
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {MONTHS.map((mo, i) => (
                  <div key={mo} className="grid grid-cols-2 gap-1.5">
                    <label className="text-[11px] font-semibold text-ink-muted">
                      {mo} #
                      <input
                        className={`${fieldClass} mt-0.5 px-2 py-1.5 text-[12px]`}
                        value={activeForm.monthlyTargets[i]}
                        disabled={pending}
                        placeholder="15"
                        onChange={(e) => setMonth(i, "monthlyTargets", e.target.value)}
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-ink-muted">
                      Label
                      <input
                        className={`${fieldClass} mt-0.5 px-2 py-1.5 text-[12px]`}
                        value={activeForm.targetDisplay[i]}
                        disabled={pending}
                        placeholder="15+"
                        onChange={(e) => setMonth(i, "targetDisplay", e.target.value)}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line-card text-brand-600"
              checked={activeForm.noTarget}
              disabled={pending}
              onChange={(e) => set("noTarget", e.target.checked)}
            />
            No numeric target (display only)
          </label>

          {error ? (
            <p
              className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <ModalFooterV2 className="mt-1 w-full !justify-between">
            {state.mode === "edit" ? (
              <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
                Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={pending || !activeForm.label.trim()}
                onClick={save}
              >
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </ModalFooterV2>
        </div>
      ) : null}
    </ModalV2>
  );
}
