"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  deleteAnalyticsGoalDefault,
  deleteAnalyticsGoalException,
  setAnalyticsGoalDefault,
  setAnalyticsGoalException,
} from "@/lib/chapters/analytics-goals-actions";
import type { GoalsSettingsModel } from "@/lib/chapters/analytics-goals";
import {
  ANALYTICS_METRIC_KEYS,
  METRIC_LABELS,
  formatMetricValue,
  monthLongLabel,
  type AnalyticsMetricKey,
} from "@/lib/chapters/analytics-pace";
import { cn } from "@/components/ui-v2";

const NETWORK_SCOPE = "__network__";

const METRIC_HINTS: Record<AnalyticsMetricKey, string> = {
  partners: "School and org partners",
  instructors: "Active instructors on the roster",
  students: "Students in class this month",
  classes: "Classes launched",
  retention: "Share of students who stay",
  quality: "Average class quality score",
};

const CHIP =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold leading-none transition";

const CHIP_ON = "bg-brand-600 text-white";
const CHIP_OFF =
  "border border-line-card bg-surface text-ink hover:border-brand-200 hover:bg-brand-50";
const CHIP_MONTH_ON = "bg-ink text-white";

const INPUT_SHELL =
  "h-10 w-full [appearance:textfield] rounded-[10px] border bg-surface pr-6 pl-2.5 text-right text-[16px] font-bold tabular-nums leading-none text-ink outline-none transition [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function parseMonthKey(key: string): { year: number; monthIndex: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, monthIndex: month - 1 };
}

function prettyMonth(key: string): string {
  const { year, monthIndex } = parseMonthKey(key);
  return monthLongLabel(year, monthIndex);
}

function metricStep(metric: AnalyticsMetricKey): number {
  return metric === "quality" ? 0.1 : 1;
}

function metricSuffix(metric: AnalyticsMetricKey): string | null {
  if (metric === "retention") return "%";
  return null;
}

function GoalField({
  metric,
  monthKey,
  scope,
  initialValue,
  clearLabel,
  placeholder,
  onSaved,
}: {
  metric: AnalyticsMetricKey;
  monthKey: string;
  scope: string;
  initialValue: number | null;
  clearLabel: string;
  placeholder: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const isCustom = initialValue != null;
  const suffix = metricSuffix(metric);

  function flashSaved() {
    setSaved(true);
    onSaved();
    setTimeout(() => setSaved(false), 1400);
  }

  function commit() {
    const trimmed = value.trim();
    if (trimmed === "") {
      if (initialValue == null) return;
      startTransition(async () => {
        const res =
          scope === NETWORK_SCOPE
            ? await deleteAnalyticsGoalDefault({ metric, monthKey })
            : await deleteAnalyticsGoalException({ chapterId: scope, metric, monthKey });
        if (res.ok) flashSaved();
        else setValue(String(initialValue));
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
          : await setAnalyticsGoalException({
              chapterId: scope,
              metric,
              monthKey,
              targetValue: num,
            });
      if (res.ok) flashSaved();
      else setValue(initialValue != null ? String(initialValue) : "");
    });
  }

  function clearToInherited() {
    if (initialValue == null) return;
    setValue("");
    startTransition(async () => {
      const res =
        scope === NETWORK_SCOPE
          ? await deleteAnalyticsGoalDefault({ metric, monthKey })
          : await deleteAnalyticsGoalException({ chapterId: scope, metric, monthKey });
      if (res.ok) flashSaved();
      else setValue(String(initialValue));
    });
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-x-6 py-3.5">
      <div className="min-w-0">
        <div className="flex min-h-5 items-center gap-2">
          <p className="m-0 truncate text-[14.5px] font-bold leading-none text-ink">
            {METRIC_LABELS[metric]}
          </p>
          {saved ? (
            <span className="shrink-0 text-[11.5px] font-semibold leading-none text-complete-700">
              Saved
            </span>
          ) : pending ? (
            <span className="shrink-0 text-[11.5px] font-semibold leading-none text-ink-muted">
              Saving…
            </span>
          ) : isCustom ? (
            <button
              type="button"
              onClick={clearToInherited}
              className="shrink-0 text-[11.5px] font-semibold leading-none text-brand-700 hover:underline"
            >
              {clearLabel}
            </button>
          ) : null}
        </div>
        <p className="m-0 mt-1 truncate text-[12.5px] leading-none text-ink-muted">
          {METRIC_HINTS[metric]}
        </p>
      </div>

      <div className="relative w-32 justify-self-end">
        <input
          type="number"
          inputMode={metric === "quality" ? "decimal" : "numeric"}
          step={metricStep(metric)}
          min={0}
          aria-label={METRIC_LABELS[metric]}
          value={value}
          placeholder={placeholder}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={cn(
            INPUT_SHELL,
            saved
              ? "border-complete-700 bg-complete-50"
              : isCustom
                ? "border-brand-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                : "border-line-card focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          )}
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 w-3.5 -translate-y-1/2 text-center text-[12px] font-semibold text-ink-muted">
          {suffix ?? ""}
        </span>
      </div>
    </div>
  );
}

export function ChapterAnalyticsGoalsSettings({
  model,
  initialChapterId,
}: {
  model: GoalsSettingsModel;
  initialChapterId?: string;
}) {
  const router = useRouter();
  const monthStripRef = useRef<HTMLDivElement>(null);
  const currentMonthKey = model.months.at(-1)?.key ?? "";

  const [scope, setScope] = useState<string>(
    initialChapterId && model.chapters.some((c) => c.id === initialChapterId)
      ? initialChapterId
      : NETWORK_SCOPE
  );
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [, startRefresh] = useTransition();

  const selectedMonth = model.months.find((m) => m.key === monthKey) ?? model.months.at(-1);
  const monthIdx = selectedMonth ? model.months.findIndex((m) => m.key === selectedMonth.key) : -1;
  const isEveryone = scope === NETWORK_SCOPE;
  const scopedChapter = isEveryone
    ? null
    : (model.perChapter.find((c) => c.chapterId === scope) ?? null);
  const chapterMeta = isEveryone ? null : model.chapters.find((c) => c.id === scope);

  const monthExceptions = model.exceptions.filter((ex) => ex.monthKey === monthKey);

  function refresh() {
    startRefresh(() => router.refresh());
  }

  function handleSaved() {
    refresh();
  }

  useEffect(() => {
    const strip = monthStripRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLElement>("[data-active-month='true']");
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
  }, []);

  if (!selectedMonth || monthIdx < 0) {
    return (
      <p className="m-0 text-[14px] text-ink-muted">No months to set goals for yet.</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/admin/chapters"
          className="text-[12.5px] font-semibold text-brand-700 no-underline hover:underline"
        >
          ← Chapters
        </Link>
        <p className="m-0 mt-3 text-[11.5px] font-bold uppercase tracking-[0.1em] text-brand-700">
          Leadership
        </p>
        <h1 className="mt-1.5 font-sans text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
          Set goals
        </h1>
        <p className="mt-2 max-w-md text-[15px] leading-snug text-ink-muted">
          Pick who, pick the month, type the numbers. They save when you click away.
        </p>
      </header>

      <section className="overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card">
        <div className="grid grid-cols-[3.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3 border-b border-line-card px-5 py-4">
          <p className="m-0 flex h-8 items-center text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            Who
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setScope(NETWORK_SCOPE)}
              className={cn(CHIP, isEveryone ? CHIP_ON : CHIP_OFF)}
            >
              Everyone
            </button>
            {model.chapters.map((c) => {
              const hasCustom = monthExceptions.some((ex) => ex.chapterId === c.id);
              const active = scope === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setScope(c.id)}
                  className={cn(CHIP, active ? CHIP_ON : CHIP_OFF)}
                >
                  {c.name}
                  {hasCustom && !active ? (
                    <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>

          <p className="m-0 flex h-8 items-center text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            Month
          </p>
          <div
            ref={monthStripRef}
            className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {model.months.map((m) => {
              const active = m.key === selectedMonth.key;
              const isCurrent = m.key === currentMonthKey;
              return (
                <button
                  key={m.key}
                  type="button"
                  data-active-month={active ? "true" : undefined}
                  onClick={() => setMonthKey(m.key)}
                  className={cn(CHIP, active ? CHIP_MONTH_ON : CHIP_OFF)}
                >
                  {m.label}
                  {isCurrent ? (
                    <span
                      className={cn(
                        "text-[10px] font-bold",
                        active ? "text-white/70" : "text-ink-muted"
                      )}
                    >
                      now
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-b border-line-card px-5 py-4">
          <h2 className="m-0 text-[16px] font-bold leading-tight tracking-tight text-ink">
            {isEveryone
              ? prettyMonth(selectedMonth.key)
              : `${scopedChapter?.chapterName ?? "Chapter"} · ${prettyMonth(selectedMonth.key)}`}
          </h2>
          <p className="m-0 mt-1 text-[13px] leading-snug text-ink-muted">
            {isEveryone
              ? "These numbers apply to every chapter that doesn’t have its own. Leave a box blank for auto."
              : chapterMeta
                ? `Only ${chapterMeta.name}. Leave a box blank to use everyone’s number. Open ${chapterMeta.monthsActive} month${chapterMeta.monthsActive === 1 ? "" : "s"}.`
                : "Only this chapter. Leave a box blank to use everyone’s number."}
          </p>
        </div>

        <div className="divide-y divide-line-card px-5">
          {ANALYTICS_METRIC_KEYS.map((metric) => {
            if (isEveryone) {
              const row = model.rows.find((r) => r.metric === metric);
              const cell = row?.cells[monthIdx];
              return (
                <GoalField
                  key={`${NETWORK_SCOPE}:${metric}:${selectedMonth.key}`}
                  metric={metric}
                  monthKey={selectedMonth.key}
                  scope={NETWORK_SCOPE}
                  initialValue={cell?.defaultValue ?? null}
                  placeholder="auto"
                  clearLabel="Use auto"
                  onSaved={handleSaved}
                />
              );
            }

            const row = scopedChapter?.rows.find((r) => r.metric === metric);
            const cell = row?.cells[monthIdx];
            const inherited = cell ? (cell.defaultValue ?? cell.rampValue) : 0;
            return (
              <GoalField
                key={`${scope}:${metric}:${selectedMonth.key}`}
                metric={metric}
                monthKey={selectedMonth.key}
                scope={scope}
                initialValue={cell?.exceptionValue ?? null}
                clearLabel={`Use ${formatMetricValue(metric, inherited)}`}
                placeholder={formatMetricValue(metric, inherited).replace("%", "")}
                onSaved={handleSaved}
              />
            );
          })}
        </div>
      </section>

      {monthExceptions.length > 0 ? (
        <section className="overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card">
          <p className="m-0 border-b border-line-card px-5 py-3 text-[12.5px] font-semibold text-ink-muted">
            {monthExceptions.length} custom number{monthExceptions.length === 1 ? "" : "s"} this month
          </p>
          <ul className="m-0 list-none p-0">
            {monthExceptions.map((ex) => (
              <li key={ex.id} className="border-b border-line-card last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    setScope(ex.chapterId);
                    setMonthKey(ex.monthKey);
                  }}
                  className="grid w-full grid-cols-[minmax(0,1fr)_8rem] items-center gap-x-6 px-5 py-3 text-left hover:bg-surface-soft"
                >
                  <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink">
                    {ex.chapterName}
                    <span className="ml-2 font-medium text-ink-muted">{METRIC_LABELS[ex.metric]}</span>
                  </span>
                  <span className="w-32 justify-self-end pr-6 text-right text-[15px] font-bold tabular-nums text-ink">
                    {formatMetricValue(ex.metric, ex.targetValue)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="m-0 px-0.5 text-[13px] text-ink-muted">
          No chapter has its own {prettyMonth(selectedMonth.key)} numbers — everyone is on the same
          targets.
        </p>
      )}
    </div>
  );
}
