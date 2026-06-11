import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
} from "@/lib/feature-flags";
import { loadData360 } from "@/lib/operations/data-360-queries";
import { countOpenWorkItems } from "@/lib/operations/work-items";
import { StatCard } from "@/components/people-strategy/stat-card";
import type { PsIconName } from "@/components/people-strategy/ps-icons";
import {
  CommandCenterSection,
  EmptyCard,
} from "@/components/people-strategy/command-center-os";
import { StrategicWorkspaceHeader } from "@/components/people-strategy/strategic-workspace-nav";
import { ConnectedExplorer } from "@/components/operations/connected-explorer";
import { NeedsAttentionQueue } from "@/components/operations/needs-attention-list";
import { UnifiedTimeline } from "@/components/operations/unified-timeline";
import { UnifiedWorkBoard } from "@/components/operations/work-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data 360 · Operations" };

/**
 * Data 360 — the connected-data control center. Where the Command Center asks
 * "what matters this week?", this page asks "how does everything connect?":
 * one executive snapshot across every tracker, one Needs Attention queue that
 * also watches partners / applicants / mentorships / class setup, one work
 * board that erases the action-vs-follow-up split, one unified timeline, and
 * a connected-data explorer where every card opens its Entity 360 panel in
 * place. Same gating as the Command Center; same shared derivations, so the
 * two pages can never disagree.
 */

const METRIC_ICON: Record<string, PsIconName> = {
  "open-actions": "layers",
  overdue: "alert",
  "due-week": "calendar",
  blocked: "flag",
  "meetings-week": "users",
  initiatives: "target",
  classes: "list",
  applicants: "inbox",
  partners: "activity",
  mentorships: "check",
};

export default async function Data360Page() {
  if (!isOperationsHubEnabled() || !isActionTrackerEnabled()) notFound();

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const data = await loadData360(viewer, { now });
  const openWork = countOpenWorkItems(data.board);

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      <StrategicWorkspaceHeader
        current="data-360"
        eyebrow="Operations · YPP OS"
        title="Data 360"
        subtitle="Every person, class, partner, meeting, and action — one connected picture, one queue of what needs attention, one board of all the work."
        meta={`${openWork} open work item${openWork === 1 ? "" : "s"} across every tracker · generated ${now.toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric" }
        )}`}
        actions={
          <>
            <Link href="/actions/new" className="button primary small">
              + New work item
            </Link>
            <Link href="/operations/command-center" className="button outline small">
              Command Center
            </Link>
          </>
        }
      />

      <div className="ps-stack" style={{ marginTop: 18, display: "grid", gap: 26 }}>
        {/* A. Executive snapshot — the whole org in one strip. */}
        <CommandCenterSection title="Executive snapshot" hint="The whole org at a glance">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {data.snapshot.map((metric) => (
              <StatCard
                key={metric.key}
                label={metric.label}
                value={metric.value}
                tone={metric.tone}
                icon={METRIC_ICON[metric.key]}
                hint={metric.hint ?? undefined}
                href={metric.href ?? undefined}
              />
            ))}
          </div>
        </CommandCenterSection>

        {/* B. Needs attention — what is at stake, in plain language. */}
        <CommandCenterSection
          title="Needs attention"
          hint="Across actions, meetings, partners, applicants, classes, and mentorship"
        >
          <NeedsAttentionQueue
            items={data.attention}
            empty={
              <EmptyCard>
                Nothing needs attention — no overdue work, no stalled pipelines, no
                quiet mentorships, no classes missing setup. 🎉
              </EmptyCard>
            }
          />
        </CommandCenterSection>

        {/* C. Unified work board — one board, every tracker. */}
        <CommandCenterSection
          title="All work"
          hint="Actions and meeting follow-ups on one board — no tracker hopping"
        >
          <UnifiedWorkBoard board={data.board} />
        </CommandCenterSection>

        {/* D + E side by side on wide screens. */}
        <div
          className="command-center-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 5fr) minmax(0, 4fr)",
            gap: 22,
            alignItems: "start",
          }}
        >
          <CommandCenterSection
            title="Connected data"
            hint="Click any card to open its 360 panel"
          >
            <ConnectedExplorer entities={data.explorer} initiatives={data.initiatives} />
          </CommandCenterSection>

          <CommandCenterSection title="Unified timeline" hint="The last 30 days, one story">
            <UnifiedTimeline events={data.timeline} />
          </CommandCenterSection>
        </div>
      </div>
    </div>
  );
}
