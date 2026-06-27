"use client";

// The Operating System hub — the "building" you walk into. Six permanent rooms,
// each shown as a calm card with its mission, an evidence-backed health read, and
// the single most pressing thing inside. No dashboard wall of metrics: the rooms
// themselves carry the story. Click a room to enter it.

import Link from "next/link";

import { StatusBadge, cn } from "@/components/ui-v2";
import { HEALTH_PRESENTATION } from "@/components/chapters/operating-room";
import type { OperatingHub } from "@/lib/chapters/operating-rooms-loader";
import type { RoomSummary } from "@/lib/chapters/operating-rooms";

export function OperatingHubView({ hub }: { hub: OperatingHub }) {
  const { building, summaries } = hub;
  return (
    <div className="flex flex-col gap-5">
      <BuildingSummary building={building} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {summaries.map((room) => (
          <RoomCard key={room.slug} room={room} />
        ))}
      </div>
    </div>
  );
}

function BuildingSummary({ building }: { building: OperatingHub["building"] }) {
  const parts: { label: string; className: string }[] = [];
  if (building.critical > 0) parts.push({ label: `${building.critical} critical`, className: "text-blocked-700" });
  if (building.needsAttention > 0)
    parts.push({ label: `${building.needsAttention} need attention`, className: "text-progress-700" });
  if (building.strong > 0) parts.push({ label: `${building.strong} strong`, className: "text-complete-700" });

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
      <span className="font-semibold text-ink">Six operating domains</span>
      {parts.map((p) => (
        <span key={p.label} className="flex items-center gap-2">
          <span aria-hidden className="text-ink-faint">·</span>
          <span className={cn("font-semibold", p.className)}>{p.label}</span>
        </span>
      ))}
    </div>
  );
}

function RoomCard({ room }: { room: RoomSummary }) {
  const p = HEALTH_PRESENTATION[room.health.status];
  return (
    <Link
      href={`/chapter/operating/${room.slug}`}
      className="group flex flex-col gap-3.5 rounded-[14px] border border-line-soft bg-surface p-5 shadow-card transition-all hover:border-brand-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="text-[22px] leading-none">
            {room.icon}
          </span>
          <div className="min-w-0">
            <h3 className="m-0 text-[16px] font-bold leading-tight text-ink">{room.title}</h3>
            <p className="m-0 mt-0.5 text-[12.5px] leading-snug text-ink-muted">{room.mission}</p>
          </div>
        </div>
        <StatusBadge tone={p.tone} withDot>
          {p.label}
        </StatusBadge>
      </div>

      <div className="rounded-[10px] bg-surface-soft px-3 py-2.5">
        {room.needsYouCount > 0 ? (
          <p className="m-0 text-[12.5px] text-ink">
            <span className="font-bold">{room.needsYouCount}</span> need{room.needsYouCount === 1 ? "s" : ""} you
            {room.topNeedsYou ? <span className="text-ink-muted"> · {room.topNeedsYou}</span> : null}
          </p>
        ) : (
          <p className="m-0 text-[12.5px] font-medium text-complete-700">All clear — nothing needs you here.</p>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[12px] text-ink-muted">{room.nextAction ?? room.question}</span>
        <span className="shrink-0 text-[12.5px] font-semibold text-brand-700 group-hover:underline">Enter →</span>
      </div>
    </Link>
  );
}
