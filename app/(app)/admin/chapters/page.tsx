import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { createChapter } from "@/lib/chapter-actions";
import { loadLeadershipChapters } from "@/lib/chapters/leadership";
import { loadChapterIntegrityIssues } from "@/lib/chapters/integrity";
import { ChapterIntegrityPanel } from "@/components/chapters/chapter-integrity-panel";
import { CHAPTER_HEALTH_LABELS } from "@/lib/chapters/health";
import { loadChapterAnalyticsLeaderboard } from "@/lib/chapters/analytics-loader";
import type { AnalyticsMetricKey } from "@/lib/chapters/analytics-pace";
import type { LeaderboardRow, PaceCell } from "@/lib/chapters/analytics-types";
import { Button, ButtonLink, StatusBadge, cn } from "@/components/ui-v2";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapters — Pathways Portal" };

const PULSE_METRICS: Array<{ key: AnalyticsMetricKey; label: string }> = [
  { key: "partners", label: "Partners" },
  { key: "instructors", label: "Instructors" },
  { key: "students", label: "Students" },
  { key: "classes", label: "Classes" },
];

const PACE_TEXT: Record<PaceCell["status"], string> = {
  above: "text-complete-700",
  on_track: "text-complete-700",
  needs_attention: "text-progress-700",
  at_risk: "text-blocked-700",
};

const HEALTH_RAIL: Record<string, string> = {
  success: "bg-complete-700",
  warning: "bg-progress-700",
  danger: "bg-blocked-700",
  info: "bg-info-700",
  neutral: "bg-idle-700",
  brand: "bg-brand-600",
};

function leaderboardHref(chapterId?: string) {
  const params = new URLSearchParams({ view: "leaderboard" });
  if (chapterId) params.set("chapter", chapterId);
  return `/chapter/impact?${params.toString()}`;
}

function barClass(pct: number): string {
  if (pct >= 100) return "bg-complete-700";
  if (pct >= 70) return "bg-brand-600";
  if (pct >= 40) return "bg-progress-700";
  return "bg-blocked-700";
}

export default async function AdminChaptersPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("STAFF")) {
    redirect("/");
  }

  const [{ cards }, integrityIssues, leaderboard] = await Promise.all([
    loadLeadershipChapters({ view: "all" }),
    loadChapterIntegrityIssues(),
    loadChapterAnalyticsLeaderboard(),
  ]);

  const paceByChapter = new Map<string, LeaderboardRow>(
    leaderboard.rows.map((r) => [r.chapterId, r])
  );

  const sorted = [...cards].sort((a, b) => {
    const aPace = paceByChapter.get(a.id)?.paceScore ?? -1;
    const bPace = paceByChapter.get(b.id)?.paceScore ?? -1;
    if (aPace !== bPace) return bPace - aPace;
    return a.name.localeCompare(b.name);
  });

  const needingCp = cards.filter((c) => !c.president).length;
  const atRisk = cards.filter((c) => c.health.label === "AT_RISK").length;

  return (
    <div className="relative min-h-full">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[280px] bg-[radial-gradient(ellipse_at_top,_rgba(107,33,200,0.08),_transparent_58%)]"
      />

      <div className="relative mx-auto flex w-full max-w-[1040px] flex-col gap-7 px-6 py-9">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.1em] text-brand-700">
              Leadership
            </p>
            <h1 className="mt-1.5 font-sans text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
              Chapters
            </h1>
            <p className="mt-2 text-[15px] leading-snug text-ink-muted">
              Check pace and set goals.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/chapter/impact/goals" variant="primary" size="md">
              Set goals
            </ButtonLink>
            <ButtonLink href={leaderboardHref()} variant="secondary" size="md">
              Leaderboard
            </ButtonLink>
          </div>
        </header>

        <div className="grid grid-cols-3 overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card">
          {[
            { label: "Chapters", value: cards.length, hint: leaderboard.asOfLabel },
            {
              label: "Need a CP",
              value: needingCp,
              hint: needingCp ? "Unstaffed" : "All staffed",
              attention: needingCp > 0,
            },
            {
              label: "At risk",
              value: atRisk,
              hint: atRisk ? "Health signal" : "None flagged",
              attention: atRisk > 0,
            },
          ].map((s, i) => (
            <div
              key={s.label}
              className={cn("px-5 py-4", i > 0 && "border-l border-line-card")}
            >
              <p
                className={cn(
                  "m-0 text-[26px] font-bold tabular-nums leading-none tracking-tight",
                  s.attention ? "text-blocked-700" : "text-ink"
                )}
              >
                {s.value}
              </p>
              <p className="m-0 mt-1.5 text-[12px] font-semibold text-ink">{s.label}</p>
              <p className="m-0 mt-0.5 text-[11.5px] text-ink-muted">{s.hint}</p>
            </div>
          ))}
        </div>

        <ChapterIntegrityPanel issues={integrityIssues} />

        {sorted.length === 0 ? (
          <p className="m-0 rounded-[14px] border border-dashed border-line-card bg-surface px-4 py-12 text-center text-[14px] text-ink-muted">
            No chapters yet. Create one below.
          </p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 lg:grid-cols-2">
            {sorted.map((c) => {
              const pace = paceByChapter.get(c.id);
              const rail = HEALTH_RAIL[c.health.tone] ?? HEALTH_RAIL.neutral;
              const pacePct = pace
                ? Math.round(Math.min(140, Math.max(0, pace.paceScore)))
                : null;

              return (
                <li
                  key={c.id}
                  className="group relative overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card transition hover:border-brand-200"
                >
                  <div aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", rail)} />
                  <Link
                    href={`/admin/chapters/${c.id}`}
                    aria-label={`Open ${c.name}`}
                    className="flex flex-col gap-4 p-5 pl-[22px] text-ink no-underline"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 text-[17px] font-bold tracking-tight text-ink group-hover:text-brand-700">
                          {c.name}
                        </p>
                        <p className="m-0 mt-1 truncate text-[13px] leading-snug text-ink-muted">
                          {c.president ? (
                            <>President {c.president.name}</>
                          ) : (
                            <span className="font-medium text-progress-700">No president yet</span>
                          )}
                        </p>
                      </div>
                      <StatusBadge
                        tone={c.health.tone}
                        title={c.health.reasons.join(" · ") || undefined}
                      >
                        {CHAPTER_HEALTH_LABELS[c.health.label]}
                      </StatusBadge>
                    </div>

                    {pace ? (
                      <div className="rounded-[12px] bg-surface-soft px-4 py-3.5 transition group-hover:bg-brand-50">
                        <div className="mb-2 flex items-baseline justify-between gap-3">
                          <span className="text-[22px] font-bold tabular-nums leading-none tracking-tight text-ink">
                            {pacePct}%
                          </span>
                          <span className="text-[12.5px] font-semibold text-brand-700">
                            Open →
                          </span>
                        </div>
                        <p className="m-0 mb-3 text-[12px] font-medium text-ink-muted">
                          of goal this month
                        </p>
                        <div className="mb-3.5 h-1.5 overflow-hidden rounded-full bg-idle-50">
                          <div
                            className={cn("h-full rounded-full", barClass(pacePct ?? 0))}
                            style={{ width: `${Math.min(100, pacePct ?? 0)}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          {PULSE_METRICS.map(({ key, label }) => {
                            const cell = pace.cells[key];
                            return (
                              <div key={key} className="min-w-0">
                                <p
                                  className={cn(
                                    "m-0 text-[14px] font-bold tabular-nums leading-none",
                                    PACE_TEXT[cell.status]
                                  )}
                                >
                                  {cell.display}
                                </p>
                                <p className="m-0 mt-1 truncate text-[11px] text-ink-muted">
                                  {label}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="m-0 text-[12.5px] font-semibold text-brand-700">
                        Open →
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-card pt-5">
          <details className="min-w-0 flex-1">
            <summary className="cursor-pointer text-[13px] font-semibold text-ink-muted hover:text-ink">
              Create a chapter
            </summary>
            <form action={createChapter} className="mt-3 flex max-w-md flex-col gap-3">
              <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
                Name
                <input
                  name="name"
                  required
                  maxLength={80}
                  className="rounded-[10px] border border-line-card px-3 py-2 text-[14px] font-normal outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
                  City
                  <input
                    name="city"
                    maxLength={120}
                    className="rounded-[10px] border border-line-card px-3 py-2 text-[14px] font-normal outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
                  Region
                  <input
                    name="region"
                    maxLength={120}
                    className="rounded-[10px] border border-line-card px-3 py-2 text-[14px] font-normal outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
              </div>
              <Button type="submit" variant="primary" size="sm" className="self-start">
                Create
              </Button>
            </form>
          </details>
          <Link
            href="/admin/chapters/map"
            className="text-[13px] font-semibold text-ink-muted no-underline hover:text-brand-700 hover:underline"
          >
            Map
          </Link>
          <Link
            href="/admin/chapters/analytics"
            className="text-[13px] font-semibold text-ink-muted no-underline hover:text-brand-700 hover:underline"
          >
            Growth
          </Link>
        </footer>
      </div>
    </div>
  );
}
