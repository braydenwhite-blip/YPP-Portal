"use client";

import { useMemo, useState } from "react";

import { CcIcon } from "@/components/command-center/icons";
import { ButtonLink, cn } from "@/components/ui-v2";

export type InitiativePlanOption = {
  id: string;
  title: string;
  description: string;
  areaLabel: string;
  priorityLabel: string;
  planHref: string;
  actionHref: string;
  meetingHref: string;
};

function FormSection({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-4">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[13px] font-bold text-brand-700"
      >
        {step}
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-ink">{title}</h2>
          {hint ? <p className="m-0 mt-0.5 text-[13px] leading-relaxed text-ink-muted">{hint}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Calm OS initiative planner — pick a priority, then start work on it. */
export function InitiativePlanStart({
  initiatives,
  cancelHref = "/operations/initiatives",
  initialId,
}: {
  initiatives: InitiativePlanOption[];
  cancelHref?: string;
  initialId?: string;
}) {
  const defaultId =
    initialId && initiatives.some((i) => i.id === initialId) ? initialId : initiatives[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(defaultId);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initiatives;
    return initiatives.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.areaLabel.toLowerCase().includes(q)
    );
  }, [initiatives, query]);

  const selected = initiatives.find((i) => i.id === selectedId) ?? null;

  const inputClass =
    "w-full rounded-[12px] border border-line-soft bg-surface px-3.5 py-2.5 text-[14px] text-ink shadow-sm transition-colors placeholder:text-ink-muted/70 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

  return (
    <div
      id="plan-initiative"
      className="overflow-hidden rounded-[20px] border border-line-soft bg-gradient-to-br from-brand-50/40 via-surface to-surface shadow-card"
    >
      <div className="space-y-8 px-5 py-6 sm:px-7 sm:py-7">
        <FormSection
          step={1}
          title="Which initiative?"
          hint="Initiatives are the big priorities your actions and meetings ladder up to."
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search initiatives…"
            className={inputClass}
            aria-label="Search initiatives"
          />
          <div className="flex flex-col gap-2">
            {filtered.length === 0 ? (
              <p className="m-0 text-[13px] text-ink-muted">No matching initiatives.</p>
            ) : (
              filtered.map((initiative) => {
                const active = selectedId === initiative.id;
                return (
                  <button
                    key={initiative.id}
                    type="button"
                    onClick={() => setSelectedId(initiative.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-[14px] border px-3.5 py-3 text-left transition-colors",
                      active
                        ? "border-brand-400 bg-brand-50/80 shadow-sm"
                        : "border-line-soft bg-surface hover:border-brand-300 hover:bg-surface-soft"
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-bold text-ink">{initiative.title}</span>
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                        {initiative.priorityLabel}
                      </span>
                    </span>
                    <span className="text-[12.5px] text-ink-muted">{initiative.areaLabel}</span>
                    {initiative.description ? (
                      <span className="line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">
                        {initiative.description}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </FormSection>

        {selected ? (
          <>
            <div className="h-px bg-line-soft/80" aria-hidden />

            <FormSection step={2} title="What's the next move?" hint="Pick one — under a minute.">
              <div className="grid gap-2 sm:grid-cols-1">
                <ButtonLink
                  href={selected.actionHref}
                  variant="primary"
                  size="md"
                  className="w-full justify-between"
                >
                  <span className="inline-flex items-center gap-2">
                    <CcIcon name="bolt" size={16} />
                    Add action for this initiative
                  </span>
                  <span aria-hidden>→</span>
                </ButtonLink>
                <ButtonLink
                  href={selected.meetingHref}
                  variant="secondary"
                  size="md"
                  className="w-full justify-between"
                >
                  <span className="inline-flex items-center gap-2">
                    <CcIcon name="calendar" size={16} />
                    Schedule a planning meeting
                  </span>
                  <span aria-hidden>→</span>
                </ButtonLink>
                <ButtonLink
                  href={selected.planHref}
                  variant="secondary"
                  size="md"
                  className="w-full justify-between"
                >
                  <span className="inline-flex items-center gap-2">
                    <CcIcon name="flag" size={16} />
                    Open the full initiative plan
                  </span>
                  <span aria-hidden>→</span>
                </ButtonLink>
              </div>
            </FormSection>
          </>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-surface/90 px-5 py-4 sm:px-7">
        <p className="m-0 text-[12.5px] text-ink-muted">Pick a priority, then add work that ladders up to it.</p>
        <ButtonLink href={cancelHref} variant="ghost" size="md">
          Cancel
        </ButtonLink>
      </footer>
    </div>
  );
}
