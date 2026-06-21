"use client";

import type { GoalRatingColor } from "@prisma/client";

import { cn } from "@/components/ui-v2";
import { PeopleCheckInCell } from "@/components/people-strategy/people-check-in-cell";
import { initialsFromName } from "@/lib/command-center/shared";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import { RATING_COLORS } from "@/lib/people-strategy/people-dashboard-selectors";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";
import {
  derivePeopleFlagText,
  feedbackStatusLabel,
  leadershipActivitySummary,
  nextCheckInDisplay,
  peopleChairTier,
  performanceQuickBullets,
  potentialQuickBullets,
} from "@/lib/people-strategy/people-performance-selectors";
import { formatRoleLabel } from "@/lib/user-title";

const AVATAR_HUES = ["#5a1da8", "#e07b2d", "#0891b2", "#0e7c52", "#7c3aed", "#1d6fd6"];

function avatarHue(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
}

function checkInSeed(id: string): number {
  return id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function RatingBadge({
  axis,
  rating,
}: {
  axis: "Performance" | "Potential";
  rating: GoalRatingColor | null | undefined;
}) {
  if (!rating) {
    return null;
  }
  const meta = RATING_COLORS[rating];
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold"
      style={{ color: meta.text, background: meta.bg }}
    >
      {axis} · {RATING_LABELS[rating]}
    </span>
  );
}

function bulletTone(text: string): "neutral" | "warning" | "danger" | "success" {
  const lower = text.toLowerCase();
  if (lower.includes("overdue") || lower.includes("declining") || lower.includes("at risk")) {
    return "danger";
  }
  if (
    lower.includes("missing") ||
    lower.includes("due") ||
    lower.includes("no review")
  ) {
    return "warning";
  }
  if (lower.includes("improving") || lower.includes("on track") || lower.includes("ready for")) {
    return "success";
  }
  return "neutral";
}

const BULLET_TONE_CLASS = {
  neutral: "text-[#5c5c74]",
  warning: "text-[#b45309]",
  danger: "text-[#c0392b]",
  success: "text-[#0e7c52]",
} as const;

function QuickBullets({ items }: { items: string[] }) {
  return (
    <div className="flex min-w-[128px] flex-col gap-1.5">
      {items.map((item) => {
        const tone = bulletTone(item);
        return (
          <div key={item} className="flex items-start gap-2">
            <span
              aria-hidden
              className={cn(
                "mt-[6px] size-1.5 shrink-0 rounded-full",
                tone === "danger" && "bg-[#c0392b]",
                tone === "warning" && "bg-[#e0a008]",
                tone === "success" && "bg-[#0e9f6e]",
                tone === "neutral" && "bg-[#c4c4d4]"
              )}
            />
            <span className={cn("text-[12.5px] font-medium leading-[1.45]", BULLET_TONE_CLASS[tone])}>
              {item}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MentorCell({ mentorName, chair }: { mentorName: string | null; chair: string }) {
  return (
    <div className="flex min-w-[108px] flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#a8a8bd]">
        Mentor
      </span>
      <span className="text-[13.5px] font-semibold leading-snug text-[#3a3a52]">
        {mentorName ?? "Unassigned"}
      </span>
      <span className="text-[11.5px] leading-snug text-[#9a9ab0]">
        Review chair ·{" "}
        <span className="font-semibold text-[#5c5c74]">{chair}</span>
      </span>
    </div>
  );
}

function LeadershipActivityCell({
  leadCount,
  execCount,
  missedMeetings,
}: {
  leadCount: number;
  execCount: number;
  missedMeetings: number;
}) {
  return (
    <div className="flex min-w-[124px] flex-col gap-1.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold leading-snug text-[#3a3a52]">
          {leadCount} leading
        </span>
        <span className="text-[13px] leading-snug text-[#5c5c74]">{execCount} executing</span>
      </div>
      {missedMeetings > 0 ? (
        <span className="text-[12px] font-semibold leading-snug text-[#c0392b]">
          {missedMeetings} missed meeting{missedMeetings === 1 ? "" : "s"}
        </span>
      ) : null}
    </div>
  );
}

/**
 * People & Reviews table — matches the handoff mockup layout and styling.
 */
export function PeoplePerformanceTable({
  rows,
  monthLabel,
  monthShortLabel,
  onOpenPerson,
  onOpenCheckIns,
}: {
  rows: PeoplePerformanceRow[];
  monthLabel: string;
  monthShortLabel: string;
  quarter: string;
  quarterlyEnabled: boolean;
  onOpenPerson: (row: PeoplePerformanceRow) => void;
  onOpenCheckIns: (row: PeoplePerformanceRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#f1f1f6] bg-[#fafafd]">
            {[
              "Person",
              "Mentor",
              "Leadership activity",
              "Performance",
              "Potential",
              "Next check-in ↑",
              "Check-in",
              "Feedback status",
            ].map((label) => (
              <th
                key={label}
                className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a8a8bd]"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-[13px] text-[#9a9ab0]">
                No one matches this view.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const name = row.name || row.email;
              const initials = initialsFromName(name);
              const roleTitle = formatRoleLabel(row.role);
              const dept = row.departments[0] ?? null;
              const next = nextCheckInDisplay(row.facts, monthShortLabel, checkInSeed(row.id));
              const feedback = feedbackStatusLabel(row.facts);
              const flagText = derivePeopleFlagText(row.facts);
              const chair = peopleChairTier(row.role);
              const activity = leadershipActivitySummary(row);

              return (
                <tr
                  key={row.id}
                  className="border-b border-[#f4f4f8] align-top last:border-b-0 hover:bg-[#fafafd]/60"
                >
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => onOpenPerson(row)}
                      className="flex items-center gap-3 border-0 bg-transparent p-0 text-left"
                    >
                      <span
                        aria-hidden
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                        style={{ background: avatarHue(name) }}
                      >
                        {initials}
                      </span>
                      <span>
                        <span className="block text-[15px] font-bold text-[#1c1a2e]">{name}</span>
                        <span className="mt-0.5 block text-[12.5px] text-[#9a9ab0]">
                          {roleTitle}
                          {dept ? ` · ${dept}` : ""}
                        </span>
                        {(row.isProvisional || flagText) && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {row.isProvisional ? (
                              <span className="rounded-[5px] bg-[#fdf2e3] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a5d00]">
                                Provisional
                              </span>
                            ) : null}
                            {flagText ? (
                              <span className="rounded-[5px] bg-[#fdecea] px-1.5 py-0.5 text-[10px] font-semibold text-[#c0392b]">
                                ⚑ {flagText}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </span>
                    </button>
                  </td>
                  <td className="min-w-[112px] px-4 py-4">
                    <MentorCell mentorName={row.mentorName} chair={chair} />
                  </td>
                  <td className="min-w-[128px] px-4 py-4">
                    <LeadershipActivityCell
                      leadCount={row.leadActions.length}
                      execCount={row.executingActions.length}
                      missedMeetings={activity.missedMeetings}
                    />
                  </td>
                  <td className="min-w-[136px] px-4 py-4">
                    {row.quarterly?.performanceRating ? (
                      <RatingBadge axis="Performance" rating={row.quarterly.performanceRating} />
                    ) : (
                      <QuickBullets
                        items={performanceQuickBullets(row, monthShortLabel)}
                      />
                    )}
                  </td>
                  <td className="min-w-[136px] px-4 py-4">
                    {row.quarterly?.potentialRating ? (
                      <RatingBadge axis="Potential" rating={row.quarterly.potentialRating} />
                    ) : (
                      <QuickBullets items={potentialQuickBullets(row)} />
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "text-[14px] font-bold",
                        next.urgent ? "text-[#c0392b]" : "text-[#1c1a2e]"
                      )}
                    >
                      {next.label}
                    </span>
                  </td>
                  <td className="min-w-[148px] px-4 py-4">
                    <PeopleCheckInCell
                      row={row}
                      monthShortLabel={monthShortLabel}
                      onOpenCheckIns={onOpenCheckIns}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-[12.5px] text-[#5c5c74]">{feedback}</span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
