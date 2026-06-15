import { redirect } from "next/navigation";

import { HomeSearchButton } from "@/components/home/home-search-button";
import {
  BrowseAllPanel,
  type CockpitLane,
  InitiativeUnblockQueue,
  LaneCard,
  OperatingModes,
  OwnerQueueSummary,
  QueueCockpit,
  QueueLanesGrid,
  RiseOnScroll,
  TriageDesk,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceShell,
} from "@/components/queue";
import { WorkHubTable } from "@/components/work/work-hub-table";
import {
  AdvancedFilters,
  ButtonLink,
  FilterChipLink,
  UrlSyncedSearchInput,
  ViewSwitcher,
} from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { buildQueueEngine, getEngineQueue } from "@/lib/queue/engine";
import { QUEUE_DESCRIPTORS, type QueueKey } from "@/lib/queue/types";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { loadWorkHub } from "@/lib/work/work-hub";
import {
  asWorkHubEntityFilter,
  asWorkHubFlag,
  filterWorkHubRowsByEntity,
  filterWorkHubRowsByFlag,
  searchWorkHubRows,
  sortWorkHubRows,
  WORK_HUB_FLAG_LABELS,
  WORK_HUB_FLAGS,
} from "@/lib/work/work-hub-rows";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mission Control — Pathways Portal",
};

// Browse-all views (the demoted full list) — unchanged from the legacy hub.
const VIEWS = ["all", "actions", "meetings", "mine"] as const;
type WorkView = (typeof VIEWS)[number];
const VIEW_LABELS: Record<WorkView, string> = {
  all: "All work",
  actions: "Actions",
  meetings: "Meetings",
  mine: "My work",
};

function asView(value: string | undefined): WorkView {
  return (VIEWS as readonly string[]).includes(value ?? "") ? (value as WorkView) : "all";
}

function browseHref(params: { view?: string; flag?: string; q?: string; entity?: string }): string {
  const search = new URLSearchParams();
  search.set("browse", "1");
  if (params.view && params.view !== "all") search.set("view", params.view);
  if (params.flag) search.set("flag", params.flag);
  if (params.entity) search.set("entity", params.entity);
  if (params.q) search.set("q", params.q);
  return `/work?${search.toString()}#browse-all`;
}

/** Cockpit lanes, in operating order. */
const COCKPIT_KEYS: QueueKey[] = [
  "leadership",
  "my",
  "quick-wins",
  "decisions",
  "meeting-prep",
  "unblock",
  "waiting",
];

export default async function MissionControlPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  if (!isOfficerTier(viewer)) redirect("/");

  const sp = await searchParams;
  const now = new Date();

  const data = await loadWorkHub(viewer, { now });
  const engine = buildQueueEngine(data, now);
  const { summary } = engine;

  // Cockpit lanes carry fuller lists than the rail previews.
  const cockpitLanes: CockpitLane[] = COCKPIT_KEYS.map((key) => ({
    key,
    descriptor: QUEUE_DESCRIPTORS[key],
    items: getEngineQueue(engine, key, now).slice(0, 40),
  }));

  // The lanes overview grid (counts + top loop + run).
  const overviewKeys: QueueKey[] = ["my", "leadership", "waiting", "decisions", "meeting-prep"];

  const initiativeItems = getEngineQueue(engine, "initiative-cleanup", now);

  // --- Browse all (the demoted full list) -------------------------------------
  const flag = asWorkHubFlag(typeof sp.flag === "string" ? sp.flag : undefined);
  const entity = asWorkHubEntityFilter(typeof sp.entity === "string" ? sp.entity : undefined);
  const entityParam = entity ? `${entity.type}:${entity.id}` : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const view = asView(typeof sp.view === "string" ? sp.view : undefined);
  const browseOpen = Boolean(sp.browse || flag || q || entity || sp.view);

  let browseRows =
    view === "meetings"
      ? data.meetingRows
      : view === "actions"
        ? data.rows.filter((r) => r.kind === "action" || r.kind === "follow_up")
        : view === "mine"
          ? sortWorkHubRows([
              ...data.rows.filter((r) => r.mine),
              ...data.meetingRows.filter((r) => r.mine),
            ])
          : sortWorkHubRows([...data.rows, ...data.meetingRows]);
  if (entity) browseRows = filterWorkHubRowsByEntity(browseRows, entity);
  if (flag) browseRows = filterWorkHubRowsByFlag(browseRows, flag, now);
  if (q) browseRows = searchWorkHubRows(browseRows, q);

  const itemWord = summary.openLoops === 1 ? "item" : "items";

  return (
    <WorkspaceShell className="px-1 pb-12">
      <WorkspaceHeader
        eyebrow="Work"
        title={
          summary.openLoops > 0
            ? `You have ${summary.openLoops} ${itemWord} to clear.`
            : "Your work is all clear."
        }
        lede="Clear the next item — not another list. Pick a queue and clear it."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/work/queue?queue=leadership" variant="primary" size="md">
              Run my queue →
            </ButtonLink>
            <ButtonLink href="/actions/new" variant="secondary" size="md">
              New action
            </ButtonLink>
            <HomeSearchButton />
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 text-[12.5px]">
          {[
            { label: "open now", value: summary.openLoops, tone: "text-ink" },
            { label: "overdue", value: summary.overdue, tone: "text-danger-700" },
            { label: "blocked", value: summary.blocked, tone: "text-warning-700" },
            { label: "need an owner", value: summary.unowned, tone: "text-warning-700" },
            { label: "need a decision", value: summary.needsDecision, tone: "text-brand-700" },
            { label: "cleared this week", value: summary.clearedThisWeek, tone: "text-success-700" },
          ].map((stat) => (
            <span
              key={stat.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface/80 px-3 py-1 shadow-card backdrop-blur"
            >
              <span className={`text-[14px] font-bold ${stat.tone}`}>{stat.value}</span>
              <span className="text-ink-muted">{stat.label}</span>
            </span>
          ))}
        </div>
      </WorkspaceHeader>

      <WorkspaceBody>
        <RiseOnScroll>
          <OperatingModes summary={summary} />
        </RiseOnScroll>

        <RiseOnScroll delayMs={60}>
          <QueueCockpit lanes={cockpitLanes} defaultKey="leadership" now={now.toISOString()} />
        </RiseOnScroll>

        <RiseOnScroll delayMs={80}>
          <section aria-label="Queue lanes">
            <h2 className="m-0 mb-3 text-[18px] font-bold text-ink">Your queues</h2>
            <QueueLanesGrid>
              {overviewKeys.map((key) => {
                const lane = engine.lanes[key];
                return (
                  <LaneCard
                    key={key}
                    label={lane.descriptor.label}
                    tagline={lane.descriptor.tagline}
                    count={lane.count}
                    accent={lane.descriptor.accent}
                    topItem={lane.items[0] ?? null}
                    runHref={`/work/queue?queue=${key}`}
                  />
                );
              })}
              <LaneCard
                label="Recently cleared"
                tagline="Loops closed across the org this week."
                count={summary.clearedThisWeek}
                accent="success"
                footnote={summary.clearedThisWeek > 0 ? "Keep the streak going." : "Clear your first loop today."}
              />
            </QueueLanesGrid>
          </section>
        </RiseOnScroll>

        <RiseOnScroll delayMs={60}>
          <section aria-label="Triage desk">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="m-0 text-[18px] font-bold text-ink">Triage desk</h2>
                <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
                  Cross-domain signals grouped by what&apos;s wrong. Each launches a focused session.
                </p>
              </div>
            </div>
            <TriageDesk groups={engine.triageGroups} />
          </section>
        </RiseOnScroll>

        {initiativeItems.length > 0 ? (
          <RiseOnScroll delayMs={40}>
            <InitiativeUnblockQueue items={initiativeItems} />
          </RiseOnScroll>
        ) : null}

        <RiseOnScroll delayMs={40}>
          <section aria-label="Owner accountability">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="m-0 text-[18px] font-bold text-ink">Owner accountability</h2>
                <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
                  Who owes what, worst-first — and the work nobody owns yet.
                </p>
              </div>
              <ButtonLink href="/work/queue?queue=owner-accountability" variant="secondary" size="sm">
                Run owner-less queue →
              </ButtonLink>
            </div>
            <OwnerQueueSummary lanes={engine.ownerLanes} />
          </section>
        </RiseOnScroll>

        <div id="browse-all">
          <BrowseAllPanel
            label="Browse all work"
            hint={`${data.rows.length + data.meetingRows.length} records · the full table & filters`}
            defaultOpen={browseOpen}
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <ViewSwitcher
                  aria-label="Work views"
                  views={VIEWS.map((value) => ({
                    key: value,
                    label: VIEW_LABELS[value],
                    href: browseHref({ view: value, q, entity: entityParam }),
                    active: view === value && !flag,
                  }))}
                />
                <UrlSyncedSearchInput
                  placeholder="Search work, owners, or entities…"
                  wrapClassName="w-full sm:w-72"
                  aria-label="Search work"
                />
              </div>
              <AdvancedFilters defaultOpen={!!flag} hint={flag ? WORK_HUB_FLAG_LABELS[flag] : undefined}>
                <FilterChipLink href={browseHref({ view, q, entity: entityParam })} active={!flag}>
                  Any status
                </FilterChipLink>
                {WORK_HUB_FLAGS.map((value) => (
                  <FilterChipLink
                    key={value}
                    href={browseHref({ view, flag: value, q, entity: entityParam })}
                    active={flag === value}
                  >
                    {WORK_HUB_FLAG_LABELS[value]}
                  </FilterChipLink>
                ))}
              </AdvancedFilters>
              <p className="m-0 text-[12.5px] text-ink-muted">
                {browseRows.length} {browseRows.length === 1 ? "record" : "records"}
                {flag ? ` · ${WORK_HUB_FLAG_LABELS[flag]}` : ""}
                {q ? ` · matching “${q}”` : ""}
              </p>
              <WorkHubTable rows={browseRows} />
            </div>
          </BrowseAllPanel>
        </div>
      </WorkspaceBody>
    </WorkspaceShell>
  );
}
