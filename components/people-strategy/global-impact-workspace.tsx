"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

const TABS = [
  { key: "agenda", label: "Agenda prep" },
  { key: "capture", label: "Meeting capture" },
  { key: "summary", label: "Summary & follow-ups" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function tabFromHash(): TabKey {
  if (typeof window === "undefined") return "agenda";
  const h = window.location.hash.replace("#", "");
  return TABS.some((t) => t.key === h) ? (h as TabKey) : "agenda";
}

export function GlobalImpactWorkspace({
  title,
  dateLabel,
  weekLabel,
  ready,
  total,
  submitHref,
  agendaNode,
  captureNode,
  summaryNode,
}: {
  title: string;
  dateLabel: string;
  weekLabel: string;
  ready: number;
  total: number;
  submitHref: string;
  agendaNode: ReactNode;
  captureNode: ReactNode;
  summaryNode: ReactNode;
}) {
  const [active, setActive] = useState<TabKey>("agenda");

  useEffect(() => {
    setActive(tabFromHash());
    const onHash = () => setActive(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 pb-12">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[12px] font-bold uppercase tracking-wide text-brand-700">Global Impact</p>
          <h1 className="m-0 mt-1 text-[28px] font-bold leading-tight text-ink">{title}</h1>
          <p className="m-0 mt-1 text-[13px] font-semibold text-ink-muted">
            {dateLabel} · {weekLabel} · {ready} of {total} teams ready
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/meetings" className="rounded-lg border border-line-soft bg-white px-3 py-2 text-[13px] font-semibold text-ink no-underline hover:border-brand-400">
            ← All meetings
          </Link>
          <Link href={submitHref} className="rounded-lg bg-brand-700 px-4 py-2 text-[13px] font-bold text-white no-underline shadow-sm">
            Submit your weekly impact
          </Link>
        </div>
      </header>

      {/* Tab nav */}
      <nav aria-label="Global Impact workflow" className="flex flex-wrap gap-1 rounded-xl border border-line-soft bg-surface-muted p-1">
        {TABS.map((t) => (
          <a
            key={t.key}
            href={`#${t.key}`}
            aria-current={active === t.key ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-[13.5px] font-semibold no-underline transition-colors ${
              active === t.key ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </a>
        ))}
      </nav>

      <div className={active === "agenda" ? "" : "hidden"}>{agendaNode}</div>
      <div className={active === "capture" ? "" : "hidden"}>{captureNode}</div>
      <div className={active === "summary" ? "" : "hidden"}>{summaryNode}</div>
    </div>
  );
}
