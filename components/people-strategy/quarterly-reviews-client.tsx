"use client";

import Link from "next/link";

import { cn } from "@/components/ui-v2";
import { initialsFromName } from "@/lib/command-center/shared";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import { RATING_COLORS } from "@/lib/people-strategy/people-dashboard-selectors";
import type { QuarterlyReviewRow } from "@/lib/people-strategy/quarterly-reviews-dashboard";
import type { GoalRatingColor } from "@prisma/client";

const AVATAR_HUES = ["#5a1da8", "#e07b2d", "#0891b2", "#0e7c52", "#7c3aed", "#1d6fd6"];

function avatarHue(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
}

const STATUS_PILL = {
  success: "bg-[#ecfdf5] text-[#047857]",
  warning: "bg-[#fdf2e3] text-[#8a5d00]",
  danger: "bg-[#fdecea] text-[#c0392b]",
  neutral: "bg-[#f4f4f8] text-[#5c5c74]",
} as const;

function RatingPill({ rating }: { rating: GoalRatingColor | null }) {
  if (!rating) {
    return <span className="text-[13px] text-[#9a9ab0]">—</span>;
  }
  const meta = RATING_COLORS[rating];
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold"
      style={{ color: meta.text, background: meta.bg }}
    >
      {RATING_LABELS[rating]}
    </span>
  );
}

function ReviewRow({ row }: { row: QuarterlyReviewRow }) {
  const initials = initialsFromName(row.name);
  return (
    <tr className="border-b border-[#f4f4f8] align-middle last:border-b-0 hover:bg-[#fafafd]/60">
      <td className="px-5 py-4">
        <Link
          href={row.personHref}
          className="flex items-center gap-3 no-underline hover:opacity-90"
        >
          <span
            aria-hidden
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
            style={{ background: avatarHue(row.name) }}
          >
            {initials}
          </span>
          <span>
            <span className="block text-[15px] font-bold text-[#1c1a2e]">{row.name}</span>
            <span className="mt-0.5 block text-[12.5px] text-[#9a9ab0]">{row.subtitle}</span>
          </span>
        </Link>
      </td>
      <td className="px-5 py-4">
        <RatingPill rating={row.performanceRating} />
      </td>
      <td className="px-5 py-4">
        <RatingPill rating={row.potentialRating} />
      </td>
      <td className="px-5 py-4">
        <span
          className={cn(
            "inline-flex whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold",
            STATUS_PILL[row.statusTone]
          )}
        >
          {row.statusLabel}
        </span>
      </td>
    </tr>
  );
}

export function QuarterlyReviewsClient({ rows }: { rows: QuarterlyReviewRow[] }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#f1f1f6] bg-[#fafafd]">
              {["Member", "Performance", "Potential", "Status"].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[#9a9ab0]"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-[13px] text-[#9a9ab0]">
                  No members in the quarterly review roster yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => <ReviewRow key={row.id} row={row} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
