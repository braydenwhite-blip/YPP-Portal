"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { useEntity360 } from "@/components/operations/entity-360-context";
import {
  ActionButtonGroup,
  cn,
  ENTITY_TONE_TO_BADGE,
  EntityChip,
  PreviewPanel,
  StatusBadge,
} from "@/components/ui-v2";
import type { Entity360, Entity360Type } from "@/lib/operations/entity-360";

/**
 * Entity preview rail — the docked, preview-first panel for master databases
 * (/people, /partners). NOT a second preview system: it fetches the exact
 * /api/entity-360 payload the universal drawer renders (same loaders, same
 * authorization, same recents recording) and re-skins it with ui-v2
 * primitives for the right-rail altitude (master plan §18: identity → status
 * → next step → key facts → relationships → recent activity → open work →
 * quick actions, ≤4 at this altitude).
 */

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 mt-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
      {children}
    </p>
  );
}

export function EntityPreviewRail({
  type,
  id,
  onClose,
  quickActions,
  className,
}: {
  type: Entity360Type;
  id: string;
  onClose?: () => void;
  /** Caller-supplied quick actions (ButtonLinks to real surfaces, ≤4). */
  quickActions?: ReactNode;
  className?: string;
}) {
  const entity360 = useEntity360();
  const [entity, setEntity] = useState<Entity360 | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setEntity(null);
    setError(null);
    fetch(`/api/entity-360/${type}/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 404 ? "This record isn't available." : "Couldn't load this record."
          );
        }
        return (await res.json()) as Entity360;
      })
      .then((data) => {
        if (active) setEntity(data);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [type, id]);

  return (
    <PreviewPanel title={`${type} preview`} onClose={onClose} className={className}>
      {error ? (
        <p className="px-5 py-6 text-[13px] text-ink-muted">{error}</p>
      ) : !entity ? (
        <div className="flex flex-col gap-3 p-5" aria-busy="true" aria-label="Loading preview">
          <div className="h-14 animate-pulse rounded-[10px] bg-brand-50" />
          <div className="h-24 animate-pulse rounded-[10px] bg-brand-50" />
          <div className="h-16 animate-pulse rounded-[10px] bg-brand-50" />
        </div>
      ) : (
        <div className="flex flex-col gap-5 p-5">
          {/* Identity */}
          <header className="flex flex-col gap-3 pr-6">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[14px] font-bold text-brand-700"
              >
                {entity.avatarUrl ? (
                  <img src={entity.avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  entity.initials
                )}
              </span>
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                  {entity.typeLabel}
                </p>
                <h2 className="m-0 truncate text-[17px] font-bold leading-tight text-ink">
                  {entity.title}
                </h2>
                {entity.subtitle ? (
                  <p className="m-0 truncate text-[12.5px] text-ink-muted">{entity.subtitle}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {entity.status ? (
                <StatusBadge tone={ENTITY_TONE_TO_BADGE[entity.status.tone] ?? "neutral"}>
                  {entity.status.label}
                </StatusBadge>
              ) : null}
              {entity.meta ? (
                <span className="text-[12px] text-ink-muted">{entity.meta}</span>
              ) : null}
            </div>
            {entity.pageHref || quickActions ? (
              <ActionButtonGroup aria-label="Quick actions">
                {entity.pageHref ? (
                  <Link
                    href={entity.pageHref}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-transparent bg-brand-600 px-3 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-brand-700"
                  >
                    Open full 360 ↗
                  </Link>
                ) : null}
                {quickActions}
              </ActionButtonGroup>
            ) : null}
          </header>

          {/* Derived signal, always with its reasons (plan §19) */}
          {entity.signal ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line-soft bg-surface-soft px-3 py-2.5">
              <StatusBadge tone={ENTITY_TONE_TO_BADGE[entity.signal.tone] ?? "neutral"}>
                {entity.signal.label}
              </StatusBadge>
              {entity.signal.detail ? (
                <span className="text-[12px] leading-snug text-ink-muted">
                  {entity.signal.detail}
                </span>
              ) : null}
            </div>
          ) : null}

          {entity.risks.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {entity.risks.map((risk, i) => (
                <p
                  key={i}
                  className="m-0 flex items-start gap-1.5 rounded-[8px] bg-danger-100/60 px-2.5 py-1.5 text-[12.5px] font-medium text-danger-700"
                >
                  <span aria-hidden>⚠</span>
                  <span>{risk}</span>
                </p>
              ))}
            </div>
          ) : null}

          {entity.nextStep ? (
            <p className="m-0 rounded-[10px] border border-brand-200 bg-brand-50 px-3 py-2.5 text-[13px] leading-snug text-brand-800">
              <strong className="font-bold">Next step:</strong> {entity.nextStep}
            </p>
          ) : null}

          {entity.glance && entity.glance.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {entity.glance.slice(0, 6).map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[10px] border border-line-soft px-2.5 py-2"
                >
                  <p
                    className={cn(
                      "m-0 text-[15px] font-bold leading-tight",
                      stat.tone === "overdue" || stat.tone === "warning"
                        ? "text-danger-700"
                        : "text-ink"
                    )}
                  >
                    {stat.value}
                  </p>
                  <p className="m-0 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {entity.facts.length > 0 ? (
            <section>
              <SectionLabel>Key facts</SectionLabel>
              <dl className="m-0 flex flex-col gap-1.5">
                {entity.facts.map((fact) => (
                  <div key={fact.label + fact.value} className="flex gap-2 text-[12.5px]">
                    <dt className="w-24 shrink-0 font-semibold text-ink-muted">{fact.label}</dt>
                    <dd className="m-0 min-w-0 break-words text-ink">
                      {fact.href ? (
                        <a href={fact.href} className="text-brand-700 hover:underline">
                          {fact.value}
                        </a>
                      ) : (
                        fact.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {entity.people.length > 0 ? (
            <section>
              <SectionLabel>Connected people</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {entity.people.map((person, i) =>
                  person.id ? (
                    <EntityChip
                      key={`${person.id}-${i}`}
                      type="person"
                      id={person.id}
                      label={person.name}
                      sublabel={person.relationship}
                      href={`/people/${person.id}`}
                    />
                  ) : (
                    <span
                      key={`${person.name}-${i}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-soft px-2.5 py-1 text-[12.5px] font-semibold text-ink"
                    >
                      {person.name}
                      <span className="font-normal text-ink-muted">· {person.relationship}</span>
                    </span>
                  )
                )}
              </div>
            </section>
          ) : null}

          {entity.classes.length > 0 ? (
            <section>
              <SectionLabel>Classes ({entity.classes.length})</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {entity.classes.map((cls) => (
                  <EntityChip
                    key={cls.id}
                    type="class"
                    id={cls.id}
                    label={cls.title}
                    sublabel={cls.status ?? undefined}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {entity.workflows && entity.workflows.length > 0 ? (
            <section>
              <SectionLabel>Workflows ({entity.workflows.length})</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {entity.workflows.slice(0, 3).map((workflow) => (
                  <Link
                    key={workflow.id}
                    href={workflow.href}
                    className="flex w-full items-center justify-between gap-2 rounded-[8px] border border-line-soft px-2.5 py-2 text-left no-underline transition-colors duration-150 hover:border-brand-400 hover:bg-brand-50/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold text-ink">
                        {workflow.title}
                      </span>
                      <span className="block truncate text-[11.5px] text-ink-muted">
                        {[workflow.stageName, workflow.progressLabel].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <StatusBadge tone={ENTITY_TONE_TO_BADGE[workflow.tone] ?? "neutral"}>
                      {workflow.healthLabel}
                    </StatusBadge>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {entity.workItems.length > 0 ? (
            <section>
              <SectionLabel>Open work ({entity.workItems.length})</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {entity.workItems.slice(0, 5).map((item) => {
                  const drawerType = item.kind === "action" ? ("action" as const) : ("meeting" as const);
                  const drawerId =
                    item.kind === "action"
                      ? item.id.replace(/^action:/, "")
                      : (item.href.split("/").pop() ?? item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => entity360?.openEntity(drawerType, drawerId)}
                      className="flex w-full items-center justify-between gap-2 rounded-[8px] border border-line-soft px-2.5 py-2 text-left transition-colors duration-150 hover:border-brand-400 hover:bg-brand-50/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold text-ink">
                          {item.title}
                        </span>
                        {item.ownerName ? (
                          <span className="block truncate text-[11.5px] text-ink-muted">
                            {item.ownerName}
                          </span>
                        ) : null}
                      </span>
                      <StatusBadge
                        tone={
                          item.tone === "danger"
                            ? "danger"
                            : item.tone === "warning"
                              ? "warning"
                              : item.tone === "success"
                                ? "success"
                                : item.tone === "info"
                                  ? "info"
                                  : "neutral"
                        }
                      >
                        {item.status}
                      </StatusBadge>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {entity.meetings.length > 0 ? (
            <section>
              <SectionLabel>Meetings</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {entity.meetings.slice(0, 3).map((meeting) => (
                  <EntityChip
                    key={meeting.id}
                    type="meeting"
                    id={meeting.id}
                    label={meeting.title}
                    sublabel={meeting.upcoming ? "Upcoming" : fmtDay(meeting.dateISO)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {entity.timeline.length > 0 ? (
            <section>
              <SectionLabel>Recent activity</SectionLabel>
              <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
                {entity.timeline.slice(0, 4).map((event) => (
                  <li key={event.id} className="flex gap-2 text-[12.5px]">
                    <span className="w-12 shrink-0 font-semibold text-ink-muted">
                      {fmtDay(event.occurredAtISO)}
                    </span>
                    <span className="min-w-0 truncate text-ink">{event.title}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {entity.footnote ? (
            <p className="m-0 border-t border-line-soft pt-3 text-[11.5px] text-ink-muted">
              {entity.footnote}
            </p>
          ) : null}
        </div>
      )}
    </PreviewPanel>
  );
}
