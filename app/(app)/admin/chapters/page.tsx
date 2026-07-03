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
  PageHeaderV2,
  CardV2,
  StatusBadge,
  StatCardV2,
  ViewSwitcher,
  EmptyStateV2,
  ButtonLink,
} from "@/components/ui-v2";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter Command — Pathways Portal" };

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

  const stateQuery = sp.state ? `&state=${encodeURIComponent(sp.state)}` : "";

  const tiles = [
    { label: "All chapters", value: summary.total, href: "/admin/chapters", accent: "neutral" as const },
    { label: "Launching", value: summary.launching, href: "/admin/chapters?view=launching", accent: "brand" as const },
    { label: "Active", value: summary.active, href: "/admin/chapters?view=active", accent: "success" as const },
    { label: "Needs support", value: summary.needsSupport, href: "/admin/chapters?view=needs_support", accent: "warning" as const },
    { label: "At risk", value: summary.atRisk, href: "/admin/chapters?view=at_risk", accent: "danger" as const },
    { label: "Missing weekly update", value: summary.missingWeeklyUpdate, href: "/admin/chapters?view=missing_weekly_update", accent: "warning" as const },
    { label: "Decisions needed", value: summary.decisionsNeeded, href: "/admin/chapters?view=decisions_needed", accent: "danger" as const },
    { label: "Bottlenecks", value: summary.bottlenecks, href: "/admin/chapters?view=bottlenecks", accent: "warning" as const },
    { label: "No upcoming meeting", value: summary.noUpcomingMeeting, href: "/admin/chapters?view=no_upcoming_meeting", accent: "warning" as const },
    { label: "Ready to scale", value: summary.readyToScale, href: "/admin/chapters?view=ready_to_scale", accent: "success" as const },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeaderV2
        eyebrow="Leadership"
        title="Chapter Command"
        subtitle="Launch, support, track, and manage every chapter nationally — one operating system, no spreadsheets."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/chapters/map" variant="secondary" size="sm">
              Chapter map
            </ButtonLink>
            <ButtonLink href="/admin/chapters/analytics" variant="secondary" size="sm">
              Analytics
            </ButtonLink>
          </div>
        }
      />

      <ChapterIntegrityPanel issues={integrityIssues} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <StatCardV2
            key={t.label}
            label={t.label}
            value={t.value}
            href={t.href}
            accent={t.accent}
            selected={
              (t.href === "/admin/chapters" && requestedView === "all") ||
              t.href.includes(`view=${requestedView}`)
            }
          />
        ))}
      </div>

      <ViewSwitcher
        aria-label="Chapter views"
        views={viewCounts.map((v) => ({
          key: v.key,
          label: v.label,
          href: `/admin/chapters?view=${v.key}${stateQuery}`,
          active: v.key === requestedView,
          count: v.count,
        }))}
      />

      {states.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="font-semibold text-ink-muted">State:</span>
          <Link
            href={`/admin/chapters?view=${requestedView}`}
            className={`rounded-full border px-2.5 py-1 ${!sp.state ? "border-brand-300 bg-brand-50 text-brand-800" : "border-line text-ink-muted hover:bg-surface-soft"}`}
          >
            All
          </Link>
          {states.map((s) => (
            <Link
              key={s}
              href={`/admin/chapters?view=${requestedView}&state=${encodeURIComponent(s)}`}
              className={`rounded-full border px-2.5 py-1 ${sp.state === s ? "border-brand-300 bg-brand-50 text-brand-800" : "border-line text-ink-muted hover:bg-surface-soft"}`}
            >
              {s}
            </Link>
          ))}
        </div>
      )}

      {cards.length === 0 ? (
        <EmptyStateV2
          title="No chapters in this view"
          body="Try another view, or create a chapter below. Approved Chapter President applications also create chapters automatically."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <CardV2 key={c.id} as="article" padding="md" className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/admin/chapters/${c.id}`}
                  className="text-[15px] font-bold text-brand-800 hover:underline"
                >
                  {c.name}
                </Link>
                <StatusBadge tone={chapterLifecycleTone(c.lifecycleStatus)}>
                  {chapterLifecycleLabel(c.lifecycleStatus)}
                </StatusBadge>
              </div>
              <p className="text-[12.5px] text-ink-muted">
                {[c.city, c.state].filter(Boolean).join(", ") || "Location not set"}
                {c.partnerSchool ? ` · ${c.partnerSchool}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink">
                <span>
                  <span className="text-ink-muted">CP:</span> {c.president?.name ?? "Unassigned"}
                </span>
                <span>
                  <span className="text-ink-muted">Members:</span> {c.memberCount}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={c.health.tone} withDot title={c.health.reasons.join("; ")}>
                  {CHAPTER_HEALTH_LABELS[c.health.label]}
                </StatusBadge>
                <span className="text-[12.5px] text-ink">{c.nextStep}</span>
              </div>
              {c.blocker && (
                <p className="text-[12.5px] font-medium text-blocked-700">⚠ {c.blocker}</p>
              )}
              {(c.flags.missingWeeklyUpdate ||
                c.radar.decisionsNeeded > 0 ||
                c.radar.bottlenecks.length > 0 ||
                c.radar.readyToScale) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {c.flags.missingWeeklyUpdate && (
                    <StatusBadge tone="warning">
                      {c.radar.weeklyUpdate === "DRAFT" ? "Weekly update not submitted" : "Missing weekly update"}
                    </StatusBadge>
                  )}
                  {c.radar.decisionsNeeded > 0 && (
                    <StatusBadge tone="danger">
                      {c.radar.decisionsNeeded === 1
                        ? "1 decision needed"
                        : `${c.radar.decisionsNeeded} decisions needed`}
                    </StatusBadge>
                  )}
                  {c.radar.bottlenecks.slice(0, 2).map((b) => (
                    <StatusBadge key={b.key} tone="warning" title={b.detail}>
                      {b.label}
                    </StatusBadge>
                  ))}
                  {c.radar.readyToScale && (
                    <StatusBadge tone="success" withDot>
                      Ready to scale
                    </StatusBadge>
                  )}
                </div>
              )}
              <div className="mt-1 flex items-center justify-between border-t border-line-soft pt-2 text-[11.5px] text-ink-muted">
                <span>Next meeting: {fmtDate(c.upcomingMeetingAt)}</span>
                <span title={`${c.radar.expectations.headline}`}>
                  {c.radar.expectations.metCount}/{c.radar.expectations.total} expectations
                </span>
                <span>Active {relDays(c.lastActivityAt, now)}</span>
              </div>
              <div className="flex items-center gap-3 text-[11.5px]">
                <Link href={`/chapter/impact?chapter=${c.id}`} className="font-semibold text-brand-800 hover:underline">
                  Impact brief
                </Link>
                <Link href={`/admin/chapters/${c.id}`} className="font-semibold text-brand-800 hover:underline">
                  Chapter 360
                </Link>
              </div>
            </CardV2>
          ))}
        </div>
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
              <input name="city" maxLength={120} className="rounded-lg border border-line px-3 py-2 text-[14px] font-normal" />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
              Region / State
              <input name="region" maxLength={120} className="rounded-lg border border-line px-3 py-2 text-[14px] font-normal" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
            Partner school (optional)
            <input name="partnerSchool" maxLength={120} className="rounded-lg border border-line px-3 py-2 text-[14px] font-normal" />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
            Internal notes (admin-only)
            <textarea name="programNotes" rows={3} maxLength={2000} className="rounded-lg border border-line px-3 py-2 text-[14px] font-normal" />
          </label>
          <button
            type="submit"
            className="self-start rounded-lg bg-brand-600 px-4 py-2 text-[14px] font-semibold text-white hover:bg-brand-700"
          >
            Create chapter
          </button>
        </form>
      </details>
    </div>
  );
}
