"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteAnalyticsGoalDefault,
  deleteAnalyticsGoalException,
  setAnalyticsGoalDefault,
  setAnalyticsGoalException,
} from "@/lib/chapters/analytics-goals-actions";
import { ANALYTICS_METRIC_KEYS, METRIC_LABELS, type AnalyticsMetricKey } from "@/lib/chapters/analytics-pace";
import type { GoalsSettingsModel } from "@/lib/chapters/analytics-goals";

const NETWORK_SCOPE = "__network__";

function GoalCell({
  metric,
  monthKey,
  scope,
  initialValue,
  placeholder,
  onSaved,
}: {
  metric: AnalyticsMetricKey;
  monthKey: string;
  /** NETWORK_SCOPE edits the network default; a chapterId edits that chapter's exception. */
  scope: string;
  initialValue: number | null;
  placeholder: number;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function commit() {
    const trimmed = value.trim();
    if (trimmed === "") {
      if (initialValue == null) return; // nothing to clear
      startTransition(async () => {
        const res =
          scope === NETWORK_SCOPE
            ? await deleteAnalyticsGoalDefault({ metric, monthKey })
            : await deleteAnalyticsGoalException({ chapterId: scope, metric, monthKey });
        if (res.ok) {
          setSaved(true);
          onSaved();
          setTimeout(() => setSaved(false), 1200);
        }
      });
      return;
    }
    const num = Number(trimmed);
    if (Number.isNaN(num)) {
      setValue(initialValue != null ? String(initialValue) : "");
      return;
    }
    if (num === initialValue) return;
    startTransition(async () => {
      const res =
        scope === NETWORK_SCOPE
          ? await setAnalyticsGoalDefault({ metric, monthKey, targetValue: num })
          : await setAnalyticsGoalException({ chapterId: scope, metric, monthKey, targetValue: num });
      if (res.ok) {
        setSaved(true);
        onSaved();
        setTimeout(() => setSaved(false), 1200);
      }
    });
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      placeholder={String(placeholder)}
      disabled={pending}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      className={`w-16 rounded-md border px-1.5 py-1 text-center text-[12px] tabular-nums outline-none transition ${
        saved
          ? "border-[#86efac] bg-[#f0fdf4]"
          : "border-[#e2e8f0] bg-white focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#ede9fe]"
      }`}
    />
  );
}

export function ChapterAnalyticsGoalsSettings({ model }: { model: GoalsSettingsModel }) {
  const router = useRouter();
  const [scope, setScope] = useState<string>(NETWORK_SCOPE);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  const scopedChapter = scope === NETWORK_SCOPE ? null : model.perChapter.find((c) => c.chapterId === scope) ?? null;

  return (
    <div className={`flex flex-col gap-5 ${pending ? "opacity-70" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/chapter/impact"
              className="rounded-full border border-[#e2e8f0] bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-[#64748b] shadow-sm transition hover:border-[#c4b5fd] hover:text-[#6b21c8]"
            >
              ← Analytics
            </Link>
          </div>
          <h1 className="mt-2 text-[24px] font-bold tracking-tight text-[#1e1b4b]">Analytics Goals</h1>
          <p className="mt-1 text-[13px] text-[#64748b]">
            Pick a chapter to set that chapter&apos;s own targets, or leave &ldquo;All Chapters&rdquo; selected
            to set the network-wide default. A chapter&apos;s own target always wins over the network default,
            which in turn wins over the calculated ramp (shown as a placeholder).
          </p>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-[#e8e4f0] bg-white shadow-[0_1px_2px_rgb(46_16_101/0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#f0ecf6] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-[#111827]">
              {scope === NETWORK_SCOPE ? "Default targets (all chapters)" : `${scopedChapter?.chapterName ?? ""} targets`}
            </h2>
            <p className="text-[12px] text-[#6b7280]">
              {scope === NETWORK_SCOPE
                ? "Applies to every chapter that hasn't set its own target for that month."
                : "Overrides the network default (and the ramp) for this chapter only. Leave blank to inherit the network default."}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] shadow-sm">
            <span className="text-[#9aa2b1]">Chapter</span>
            <select
              className="max-w-[200px] border-0 bg-transparent font-semibold text-[#111827] outline-none"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value={NETWORK_SCOPE}>All Chapters (network default)</option>
              {model.chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto px-3 pb-3 pt-2">
          <table className="w-full border-separate border-spacing-y-1 text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.05em] text-[#9aa2b1]">
                <th className="px-2 py-2 font-semibold">Metric</th>
                {model.months.map((m) => (
                  <th key={m.key} className="px-1 py-2 text-center font-semibold">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ANALYTICS_METRIC_KEYS.map((metric) => {
                const networkRow = model.rows.find((r) => r.metric === metric)!;
                const chapterRow = scopedChapter?.rows.find((r) => r.metric === metric) ?? null;
                return (
                  <tr key={metric}>
                    <td className="px-2 py-1.5 text-[12.5px] font-semibold text-[#1e1b4b]">
                      {METRIC_LABELS[metric]}
                    </td>
                    {model.months.map((m, idx) => {
                      if (scope === NETWORK_SCOPE) {
                        const cell = networkRow.cells[idx];
                        return (
                          <td key={m.key} className="px-1 py-1.5 text-center">
                            <GoalCell
                              key={`${NETWORK_SCOPE}:${metric}:${m.key}`}
                              metric={metric}
                              monthKey={m.key}
                              scope={NETWORK_SCOPE}
                              initialValue={cell.defaultValue}
                              placeholder={cell.rampValue}
                              onSaved={refresh}
                            />
                          </td>
                        );
                      }
                      const cell = chapterRow?.cells[idx];
                      const placeholder = cell ? cell.defaultValue ?? cell.rampValue : 0;
                      return (
                        <td key={m.key} className="px-1 py-1.5 text-center">
                          <GoalCell
                            key={`${scope}:${metric}:${m.key}`}
                            metric={metric}
                            monthKey={m.key}
                            scope={scope}
                            initialValue={cell?.exceptionValue ?? null}
                            placeholder={placeholder}
                            onSaved={refresh}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e8e4f0] bg-white shadow-[0_1px_2px_rgb(46_16_101/0.04)]">
        <div className="border-b border-[#f0ecf6] px-4 py-3">
          <h2 className="text-[15px] font-bold text-[#111827]">Active per-chapter overrides</h2>
          <p className="text-[12px] text-[#6b7280]">
            Every chapter-specific target currently set, across all chapters — for a quick audit. Switch the
            chapter selector above to edit or clear one.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="bg-[#fbfafe] text-[10px] uppercase tracking-[0.05em] text-[#94a3b8]">
                <th className="px-3 py-2 font-semibold">Chapter</th>
                <th className="px-3 py-2 font-semibold">Metric</th>
                <th className="px-3 py-2 font-semibold">Month</th>
                <th className="px-3 py-2 text-right font-semibold">Target</th>
                <th className="px-3 py-2 font-semibold">Updated by</th>
              </tr>
            </thead>
            <tbody>
              {model.exceptions.map((ex) => (
                <tr
                  key={ex.id}
                  className="cursor-pointer border-t border-[#f6f3fb] transition hover:bg-[#fbfafe]"
                  onClick={() => setScope(ex.chapterId)}
                >
                  <td className="px-3 py-2 font-medium text-[#1e1b4b]">{ex.chapterName}</td>
                  <td className="px-3 py-2 text-[#475569]">{METRIC_LABELS[ex.metric]}</td>
                  <td className="px-3 py-2 text-[#475569]">{ex.monthKey}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#1e1b4b]">
                    {ex.targetValue}
                  </td>
                  <td className="px-3 py-2 text-[#94a3b8]">{ex.updatedByName}</td>
                </tr>
              ))}
              {model.exceptions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[12px] text-[#94a3b8]">
                    No chapter has a custom target yet — everyone is on the network default / ramp.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
