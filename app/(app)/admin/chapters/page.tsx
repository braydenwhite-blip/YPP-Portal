import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { createChapter } from "@/lib/chapter-actions";
import { loadLeadershipChapters } from "@/lib/chapters/leadership";
import { loadChapterIntegrityIssues } from "@/lib/chapters/integrity";
import { ChapterIntegrityPanel } from "@/components/chapters/chapter-integrity-panel";
import {
  chapterLifecycleLabel,
  chapterLifecycleTone,
} from "@/lib/chapters/lifecycle";
import { CHAPTER_HEALTH_LABELS } from "@/lib/chapters/health";
import {
  AdvancedFilters,
  ButtonLink,
  EmptyStateV2,
  FilterChipLink,
  MetricStrip,
  PageHeaderV2,
  StatusBadge,
  TrackerRow,
  TrackerShell,
} from "@/components/ui-v2";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter Command — Pathways Portal" };

/** Primary lifecycle views shown in the switcher. Everything else lives under More filters. */
const PRIMARY_VIEWS = new Set(["all", "launching", "active", "needs_support", "at_risk"]);

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function relDays(d: Date, now: Date): string {
  const days = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return fmtDate(d);
}

function chaptersHref(opts: { view?: string; state?: string }): string {
  const params = new URLSearchParams();
  if (opts.view && opts.view !== "all") params.set("view", opts.view);
  if (opts.state) params.set("state", opts.state);
  const qs = params.toString();
  return qs ? `/admin/chapters?${qs}` : "/admin/chapters";
}

export default async function AdminChaptersPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; state?: string }>;
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("STAFF")) {
    redirect("/");
  }

  const sp = (await searchParams) ?? {};
  const [{ cards, viewCounts, requestedView, states, summary }, integrityIssues] =
    await Promise.all([
      loadLeadershipChapters({ view: sp.view, state: sp.state }),
      loadChapterIntegrityIssues(),
    ]);
  const now = new Date();

  const primaryViews = viewCounts.filter((v) => PRIMARY_VIEWS.has(v.key));
  const signalViews = viewCounts.filter((v) => !PRIMARY_VIEWS.has(v.key));
  const activeSignal = signalViews.find((v) => v.key === requestedView);
  const deepFilterCount = (activeSignal ? 1 : 0) + (sp.state ? 1 : 0);

  const countLabel = [
    `${cards.length} chapter${cards.length === 1 ? "" : "s"}`,
    activeSignal ? activeSignal.label.toLowerCase() : null,
    sp.state ? sp.state : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <TrackerShell
      className="px-6 py-8"
      eyebrow="Leadership"
      title="Chapter Command"
      subtitle="Every chapter nationally — health, next steps, goals, and support in one place."
      primaryAction={
        <ButtonLink href="/chapter/impact/goals" variant="primary" size="md">
          Goals
        </ButtonLink>
      }
      secondaryAction={
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/chapters/map" variant="secondary" size="md">
            Map
          </ButtonLink>
          <ButtonLink href="/admin/chapters/analytics" variant="secondary" size="md">
            Analytics
          </ButtonLink>
        </div>
      }
      metrics={
        <MetricStrip
          aria-label="Chapter pipeline"
          metrics={[
            {
              label: "All chapters",
              value: summary.total,
              href: chaptersHref({ state: sp.state }),
            },
            {
              label: "Launching",
              value: summary.launching,
              href: chaptersHref({ view: "launching", state: sp.state }),
            },
            {
              label: "Active",
              value: summary.active,
              href: chaptersHref({ view: "active", state: sp.state }),
            },
            {
              label: "Needs support",
              value: summary.needsSupport,
              href: chaptersHref({ view: "needs_support", state: sp.state }),
              tone: summary.needsSupport > 0 ? "attention" : "default",
            },
            {
              label: "At risk",
              value: summary.atRisk,
              href: chaptersHref({ view: "at_risk", state: sp.state }),
              tone: summary.atRisk > 0 ? "attention" : "default",
            },
          ]}
        />
      }
      views={primaryViews.map((v) => ({
        key: v.key,
        label: v.label,
        href: chaptersHref({ view: v.key, state: sp.state }),
        active: v.key === requestedView || (requestedView === "all" && v.key === "all"),
        count: v.count,
      }))}
      filters={
        <AdvancedFilters
          label="More filters"
          defaultOpen={deepFilterCount > 0}
          hint={
            deepFilterCount > 0
              ? [activeSignal?.label, sp.state].filter(Boolean).join(" · ")
              : undefined
          }
        >
          {signalViews.map((v) => (
            <FilterChipLink
              key={v.key}
              href={chaptersHref({ view: v.key, state: sp.state })}
              active={v.key === requestedView}
              count={v.count}
            >
              {v.label}
            </FilterChipLink>
          ))}
          {states.length > 0 ? (
            <>
              <span aria-hidden className="mx-1 h-5 w-px bg-line" />
              <FilterChipLink
                href={chaptersHref({ view: requestedView })}
                active={!sp.state}
              >
                All states
              </FilterChipLink>
              {states.map((s) => (
                <FilterChipLink
                  key={s}
                  href={chaptersHref({ view: requestedView, state: s })}
                  active={sp.state === s}
                >
                  {s}
                </FilterChipLink>
              ))}
            </>
          ) : null}
        </AdvancedFilters>
      }
      count={countLabel}
    >
      <ChapterIntegrityPanel issues={integrityIssues} />

      {cards.length === 0 ? (
        <EmptyStateV2
          title="No chapters in this view"
          body="Try another filter, or create a chapter below. Approved Chapter President applications also create chapters automatically."
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {cards.map((c) => {
            const location = [c.city, c.state].filter(Boolean).join(", ") || null;
            const metaParts = [
              location,
              c.president?.name ? `CP · ${c.president.name}` : "CP unassigned",
              `${c.memberCount} member${c.memberCount === 1 ? "" : "s"}`,
              `Active ${relDays(c.lastActivityAt, now)}`,
            ];
            const signalBits = [
              c.flags.missingWeeklyUpdate
                ? c.radar.weeklyUpdate === "DRAFT"
                  ? "Weekly update draft"
                  : "Missing weekly update"
                : null,
              c.radar.decisionsNeeded > 0
                ? `${c.radar.decisionsNeeded} decision${c.radar.decisionsNeeded === 1 ? "" : "s"}`
                : null,
              c.radar.bottlenecks[0]?.label ?? null,
              c.radar.readyToScale ? "Ready to scale" : null,
            ].filter(Boolean);

            return (
              <TrackerRow
                key={c.id}
                title={c.name}
                href={`/admin/chapters/${c.id}`}
                status={{
                  label: CHAPTER_HEALTH_LABELS[c.health.label],
                  tone: c.health.tone,
                  title: c.health.reasons.join("; ") || undefined,
                }}
                meta={
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                    <StatusBadge tone={chapterLifecycleTone(c.lifecycleStatus)}>
                      {chapterLifecycleLabel(c.lifecycleStatus)}
                    </StatusBadge>
                    <span>{metaParts.join(" · ")}</span>
                    {signalBits.length > 0 ? (
                      <span className="text-progress-700">{signalBits.join(" · ")}</span>
                    ) : null}
                  </span>
                }
                nextStep={
                  c.blocker ? (
                    <span className="text-blocked-700">⚠ {c.blocker}</span>
                  ) : (
                    <>
                      {c.nextStep}
                      {c.upcomingMeetingAt
                        ? ` · Next meeting ${fmtDate(c.upcomingMeetingAt)}`
                        : ""}
                    </>
                  )
                }
                action={
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/chapter/impact?chapter=${c.id}`}
                      className="text-[12.5px] font-semibold text-brand-700 no-underline hover:underline"
                    >
                      Brief
                    </Link>
                    <ButtonLink href={`/admin/chapters/${c.id}`} variant="secondary" size="sm">
                      Open
                    </ButtonLink>
                  </div>
                }
              />
            );
          })}
        </ul>
      )}

      <details className="mt-2 rounded-[14px] border border-line-card bg-surface p-5 shadow-card">
        <summary className="cursor-pointer text-[14px] font-semibold text-ink">
          + Create a new chapter
        </summary>
        <form action={createChapter} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
            Chapter name
            <input
              name="name"
              required
              maxLength={80}
              className="rounded-lg border border-line px-3 py-2 text-[14px] font-normal"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
              City
              <input
                name="city"
                maxLength={120}
                className="rounded-lg border border-line px-3 py-2 text-[14px] font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
              Region / State
              <input
                name="region"
                maxLength={120}
                className="rounded-lg border border-line px-3 py-2 text-[14px] font-normal"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
            Partner school (optional)
            <input
              name="partnerSchool"
              maxLength={120}
              className="rounded-lg border border-line px-3 py-2 text-[14px] font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
            Internal notes (admin-only)
            <textarea
              name="programNotes"
              rows={3}
              maxLength={2000}
              className="rounded-lg border border-line px-3 py-2 text-[14px] font-normal"
            />
          </label>
          <button
            type="submit"
            className="self-start rounded-lg bg-brand-600 px-4 py-2 text-[14px] font-semibold text-white hover:bg-brand-700"
          >
            Create chapter
          </button>
        </form>
      </details>
    </TrackerShell>
  );
}
