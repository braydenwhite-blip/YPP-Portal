"use client";

import Link from "next/link";
import { useState } from "react";

import { cn } from "@/components/ui-v2";
import { initialsFromName } from "@/lib/command-center/shared";
import {
  MENTORSHIP_DASHBOARD_FILTERS,
  MENTORSHIP_FILTER_META,
  type MentorshipApplicationRow,
  type MentorshipCommitteeRow,
  type MentorshipDashboardData,
  type MentorshipDashboardFilter,
  type MentorshipQueueRow,
} from "@/lib/people-strategy/mentorship-dashboard";

const AVATAR_HUES = ["#5a1da8", "#e07b2d", "#0891b2", "#0e7c52", "#7c3aed", "#1d6fd6"];

function avatarHue(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
}

const STATUS_PILL: Record<MentorshipQueueRow["statusTone"], string> = {
  warning: "bg-[#fdf2e3] text-[#8a5d00]",
  info: "bg-[#eef4ff] text-[#1d4ed8]",
  success: "bg-[#ecfdf5] text-[#047857]",
  danger: "bg-[#fdecea] text-[#c0392b]",
  neutral: "bg-[#f4f4f8] text-[#5c5c74]",
};

const APP_STATUS_PILL: Record<MentorshipApplicationRow["statusTone"], string> = {
  warning: "bg-[#fdf2e3] text-[#8a5d00]",
  brand: "bg-[#f3edff] text-[#5a1da8]",
  info: "bg-[#eef4ff] text-[#1d4ed8]",
};

function FilterTabs({
  active,
  counts,
  onChange,
}: {
  active: MentorshipDashboardFilter;
  counts: Record<MentorshipDashboardFilter, number>;
  onChange: (filter: MentorshipDashboardFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {MENTORSHIP_DASHBOARD_FILTERS.map((key) => {
        const meta = MENTORSHIP_FILTER_META[key];
        const selected = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors",
              selected
                ? "border-[#dcd4f5] bg-[#f5f0ff] text-[#5a1da8]"
                : "border-[#ebebf2] bg-white text-[#5c5c74] hover:border-[#dcd4f5]"
            )}
          >
            <span aria-hidden className={cn("size-2 rounded-full", meta.dotClass)} />
            {meta.label}
            <span
              className={cn(
                "inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                selected ? "bg-[#5a1da8] text-white" : "bg-[#f0f0f5] text-[#717189]"
              )}
            >
              {counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function QueueRowMenu({ row }: { row: MentorshipQueueRow }) {
  return (
    <div className="relative">
      <details className="group">
        <summary
          className="flex size-8 cursor-pointer list-none items-center justify-center rounded-lg text-[#9a9ab0] hover:bg-[#f4f4f8] hover:text-[#5c5c74]"
          aria-label={`Actions for ${row.name}`}
        >
          ···
        </summary>
        <div className="absolute right-0 z-10 mt-1 min-w-[168px] rounded-lg border border-[#ebebf2] bg-white py-1 shadow-lg">
          <Link
            href={row.personHref}
            className="block px-3 py-2 text-[12.5px] font-medium text-[#1c1a2e] no-underline hover:bg-[#fafafd]"
          >
            Person record
          </Link>
          <Link
            href={row.adminHref}
            className="block px-3 py-2 text-[12.5px] font-medium text-[#1c1a2e] no-underline hover:bg-[#fafafd]"
          >
            Mentorship record
          </Link>
        </div>
      </details>
    </div>
  );
}

function QueueRow({ row }: { row: MentorshipQueueRow }) {
  const initials = initialsFromName(row.name);
  return (
    <article className="flex items-center gap-3 border-b border-[#f4f4f8] px-5 py-4 last:border-b-0">
      <span
        aria-hidden
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
        style={{ background: avatarHue(row.name) }}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-[15px] font-bold text-[#1c1a2e]">{row.name}</p>
        <p className="m-0 mt-0.5 truncate text-[12.5px] text-[#9a9ab0]">{row.subtitle}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-3 py-1 text-[11.5px] font-semibold whitespace-nowrap",
          STATUS_PILL[row.statusTone]
        )}
      >
        {row.statusLabel}
      </span>
      <QueueRowMenu row={row} />
    </article>
  );
}

function ApplicationsCard({ applications }: { applications: MentorshipApplicationRow[] }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#e4d8f7] bg-[#faf7ff] shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
      <header className="border-b border-[#ebe0fa] bg-[#f3edff] px-4 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-[#5a1da8]">
            <DocIcon />
          </span>
          <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-[#5a1da8]">
            Applications & interviews
          </h2>
        </div>
        <p className="m-0 mt-2 text-[12px] leading-relaxed text-[#5c5c74]">
          Mentorship reviews & interviews are tracked through the meeting tracker
          and linked to each person&apos;s record.
        </p>
      </header>
      {applications.length === 0 ? (
        <p className="m-0 px-4 py-6 text-[12.5px] text-[#9a9ab0]">No open applications.</p>
      ) : (
        applications.map((app) => (
          <article
            key={app.id}
            className="border-b border-[#ebe0fa] px-4 py-4 last:border-b-0"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                style={{ background: avatarHue(app.name) }}
              >
                {initialsFromName(app.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="m-0 text-[14px] font-bold text-[#1c1a2e]">{app.name}</p>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      APP_STATUS_PILL[app.statusTone]
                    )}
                  >
                    {app.statusLabel}
                  </span>
                </div>
                <p className="m-0 mt-0.5 text-[12px] text-[#9a9ab0]">{app.programLabel}</p>
                <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-[#5c5c74]">
                  {app.detailText}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={app.meetingsHref}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#dcd4f5] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#5a1da8] no-underline hover:bg-[#f5f0ff]"
                  >
                    <CalendarIcon className="size-3.5" />
                    Meeting tracker
                  </Link>
                  <Link
                    href={app.personHref}
                    className="inline-flex items-center rounded-lg border border-[#dcd4f5] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#5a1da8] no-underline hover:bg-[#f5f0ff]"
                  >
                    Person record →
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))
      )}
    </section>
  );
}

function CommitteesCard({ committees }: { committees: MentorshipCommitteeRow[] }) {
  return (
    <section className="rounded-[14px] border border-[#ebebf2] bg-white p-5 shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
      <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-[#9a9ab0]">
        Mentor committees · quarterly
      </h2>
      <ul className="m-0 mt-4 flex list-none flex-col gap-4 p-0">
        {committees.map((row) => (
          <li key={row.id} className="border-b border-[#f4f4f8] pb-4 last:border-b-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <p className="m-0 text-[14px] font-bold text-[#1c1a2e]">{row.tier}</p>
              <span className="shrink-0 text-[13px] font-semibold text-[#0e7c52]">
                {row.meetingDateLabel}
              </span>
            </div>
            <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-[#717189]">
              {row.chairLine}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
      <path d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.414a2 2 0 0 0-.586-1.414l-3.414-3.414A2 2 0 0 0 12.586 2H4zm8 0v4h4L12 3z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M5.25 3A2.25 2.25 0 0 0 3 5.25v9.5A2.25 2.25 0 0 0 5.25 17h9.5A2.25 2.25 0 0 0 17 14.75v-9.5A2.25 2.25 0 0 0 14.75 3H5.25ZM6 5h8v1H6V5Zm0 3h8v1H6V8Zm0 3h5v1H6v-1Z" />
    </svg>
  );
}

export function MentorshipDashboardClient({ data }: { data: MentorshipDashboardData }) {
  const [filter, setFilter] = useState<MentorshipDashboardFilter>("needs-review");
  const meta = MENTORSHIP_FILTER_META[filter];
  const rows = data.queues[filter];

  return (
    <>
      <FilterTabs active={filter} counts={data.counts} onChange={setFilter} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
          <header className="border-b border-[#f1f1f6] px-5 py-4">
            <div className="flex items-center gap-2">
              <span aria-hidden className={cn("size-2 rounded-full", meta.dotClass)} />
              <h2 className="m-0 text-[15px] font-bold text-[#1c1a2e]">{meta.sectionTitle}</h2>
            </div>
            <p className="m-0 mt-1 text-[12.5px] text-[#9a9ab0]">{meta.sectionHint}</p>
          </header>
          {rows.length === 0 ? (
            <p className="m-0 px-5 py-12 text-center text-[13px] text-[#9a9ab0]">
              No one in this queue right now.
            </p>
          ) : (
            rows.map((row) => <QueueRow key={row.id} row={row} />)
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <ApplicationsCard applications={data.applications} />
          <CommitteesCard committees={data.committees} />
        </aside>
      </div>
    </>
  );
}
