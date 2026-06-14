import { redirect } from "next/navigation";

import { HomeSearchButton } from "@/components/home/home-search-button";
import { WorkHubTable } from "@/components/work/work-hub-table";
import {
  ButtonLink,
  CardV2,
  EntityChip,
  FilterBar,
  FilterChipLink,
  PageHeaderV2,
  RecordSection,
  StatusBadge,
  TrackerStartCard,
  UrlSyncedSearchInput,
} from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import type { Entity360Type } from "@/lib/operations/entity-360";
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
  title: "Work — Pathways Portal",
};

const VIEWS = ["attention", "mine", "actions", "meetings", "initiatives", "all"] as const;
type WorkView = (typeof VIEWS)[number];

const VIEW_LABELS: Record<WorkView, string> = {
  all: "All",
  actions: "Actions",
  meetings: "Meetings",
  initiatives: "Initiatives",
  mine: "My work",
  attention: "Needs attention",
};

/** Aliases so natural spellings of a view land on the canonical one. */
const VIEW_ALIASES: Record<string, WorkView> = {
  my: "mine",
  "my-queue": "mine",
  "needs-attention": "attention",
};

function asView(value: string | undefined): WorkView {
  if (value && VIEW_ALIASES[value]) return VIEW_ALIASES[value];
  return (VIEWS as readonly string[]).includes(value ?? "") ? (value as WorkView) : "attention";
}

function workHref(params: {
  view?: string;
  flag?: string;
  q?: string;
  entity?: string;
}): string {
  const search = new URLSearchParams();
  if (params.view && params.view !== "all") search.set("view", params.view);
  if (params.flag) search.set("flag", params.flag);
  if (params.entity) search.set("entity", params.entity);
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return qs ? `/work?${qs}` : "/work";
}

const SEVERITY_TONE: Record<string, "danger" | "warning" | "info"> = {
  critical: "danger",
  warning: "warning",
  watch: "info",
  neutral: "info",
};

function workStart({
  stats,
  myWorkCount,
}: {
  stats: Awaited<ReturnType<typeof loadWorkHub>>["stats"];
  myWorkCount: number;
}): { title: string; description: string; href: string; label: string } {
  if (stats.needsAttention > 0) {
    return {
      title: "Review the work that needs attention first.",
      description:
        "This queue gathers overdue work, blockers, missing owners, open meeting follow-ups, and records with no clear next step.",
      href: workHref({ view: "needs-attention" }),
      label: "Review needs attention",
    };
  }
  if (myWorkCount > 0) {
    return {
      title: "Your own queue is the best next stop.",
      description:
        "Nothing is currently flagged across the portal, so start with the actions and meetings connected to you.",
      href: workHref({ view: "my" }),
      label: "Open my work",
    };
  }
  return {
    title: "The work queues are calm right now.",
    description:
      "Create a new action when something needs an owner, or log a meeting when decisions and follow-ups need to be captured.",
    href: "/actions?create=1",
    label: "Create action",
  };
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Work Hub (Knowledge OS V2, plan §15) — the one place for everything someone
 * has to do: tracker actions, meeting follow-ups, upcoming meetings, open
 * partner requests, partner follow-ups, advisor check-ins, applicant next
 * steps, and quiet mentorships, in one triaged list. Click a row for its 360
 * preview; the full record and a concrete quick action are always one click
 * away. Replaces browsing across /actions/all, /actions/meetings, and
 * /operations/initiatives (those pages keep their editing tools).
 */
export default async function WorkHubPage({
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
  // The hub crosses partner / applicant / advising domains — officer tier,
  // mirroring /people, /partners and the operations surfaces.
  if (!isOfficerTier(viewer)) redirect("/");

  const sp = await searchParams;
  const view = asView(typeof sp.view === "string" ? sp.view : undefined);
  const flag = asWorkHubFlag(typeof sp.flag === "string" ? sp.flag : undefined);
  const entity = asWorkHubEntityFilter(
    typeof sp.entity === "string" ? sp.entity : undefined
  );
  const entityParam = entity ? `${entity.type}:${entity.id}` : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;

  const now = new Date();
  const data = await loadWorkHub(viewer, { now });
  const myWorkCount =
    data.rows.filter((row) => row.mine).length +
    data.meetingRows.filter((row) => row.mine).length;
  const start = workStart({ stats: data.stats, myWorkCount });

  // The table's row set per view, then flag + search narrowing.
  let rows =
    view === "meetings"
      ? data.meetingRows
      : view === "actions"
        ? data.rows.filter((row) => row.kind === "action" || row.kind === "follow_up")
        : view === "mine"
          ? // My queue includes the viewer's meetings (facilitating/attending,
            // upcoming or carrying open follow-ups) beside their work rows.
            sortWorkHubRows([
              ...data.rows.filter((row) => row.mine),
              ...data.meetingRows.filter((row) => row.mine),
            ])
          : data.rows;
  if (entity && view === "all") {
    // The entity lens spans meetings too: the meeting's own row (or the
    // meetings about a partner/class/person) belongs in "work connected to
    // this entity". The two row sets are disjoint, so the union is safe.
    rows = sortWorkHubRows([...rows, ...data.meetingRows]);
  }
  if (entity) rows = filterWorkHubRowsByEntity(rows, entity);
  if (flag) rows = filterWorkHubRowsByFlag(rows, flag, now);
  if (q) rows = searchWorkHubRows(rows, q);

  // The entity filter's display label: the first matching row's chip label.
  const entityLabel = entity
    ? (rows.find((row) => row.entityLabel)?.entityLabel ?? entity.type)
    : null;

  const showAttentionSummary = view === "attention" && !flag && !q && !entity;
  const showTable = view !== "initiatives" && !showAttentionSummary;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <PageHeaderV2
        eyebrow="Work"
        title="Work"
        subtitle="Actions, meeting follow-ups, blockers, and next steps across YPP."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/actions/new" variant="primary" size="md">
              Create action
            </ButtonLink>
            <ButtonLink href="/actions/meetings?new=1" variant="secondary" size="md">
              Log meeting
            </ButtonLink>
          </div>
        }
      >
        <HomeSearchButton />
      </PageHeaderV2>

      <TrackerStartCard
        title={start.title}
        description={start.description}
        action={
          <ButtonLink href={start.href} variant="secondary" size="sm">
            {start.label}
          </ButtonLink>
        }
        facts={[
          {
            label: "need attention",
            value: data.stats.needsAttention,
            href: workHref({ view: "needs-attention" }),
            tone: data.stats.needsAttention > 0 ? "attention" : "default",
          },
          {
            label: "your work",
            value: myWorkCount,
            href: workHref({ view: "my" }),
          },
          {
            label: "blocked",
            value: data.stats.blocked,
            href: workHref({ flag: "blocked" }),
            tone: data.stats.blocked > 0 ? "danger" : "default",
          },
          {
            label: "upcoming meetings",
            value: data.stats.upcomingMeetings,
            href: workHref({ view: "meetings" }),
          },
        ]}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterBar aria-label="Work views">
            {VIEWS.map((value) => (
              <FilterChipLink
                key={value}
                href={workHref({ view: value, q, entity: entityParam })}
                active={view === value && !flag}
              >
                {VIEW_LABELS[value]}
              </FilterChipLink>
            ))}
            {entity ? (
              <>
                <span aria-hidden className="mx-1 h-5 w-px bg-line" />
                <FilterChipLink href={workHref({ view, flag: flag ?? undefined, q })} active>
                  {entityLabel} ✕
                </FilterChipLink>
              </>
            ) : null}
          </FilterBar>
          {showTable ? (
            <UrlSyncedSearchInput
              placeholder="Search work, owners, or entities…"
              wrapClassName="w-full sm:w-72"
              aria-label="Search work"
            />
          ) : null}
        </div>

        <details
          open={!!flag}
          className="rounded-[10px] border border-line-soft bg-surface px-3.5 py-2"
        >
          <summary className="cursor-pointer text-[12.5px] font-semibold text-ink-muted">
            More filters{flag ? ` · ${WORK_HUB_FLAG_LABELS[flag]}` : ""}
          </summary>
          <FilterBar aria-label="Work status filters" className="mt-2">
            <FilterChipLink
              href={workHref({ view, q, entity: entityParam })}
              active={!flag}
            >
              Any status
            </FilterChipLink>
            {WORK_HUB_FLAGS.map((value) => (
              <FilterChipLink
                key={value}
                href={workHref({ view, flag: value, q, entity: entityParam })}
                active={flag === value}
              >
                {WORK_HUB_FLAG_LABELS[value]}
              </FilterChipLink>
            ))}
          </FilterBar>
        </details>
      </div>

      {showTable ? (
        <>
          <p className="m-0 text-[12.5px] text-ink-muted">
            {rows.length} {rows.length === 1 ? "item" : "items"}
            {flag ? ` · ${WORK_HUB_FLAG_LABELS[flag]}` : ""}
            {q ? ` · matching “${q}”` : ""}
          </p>
          <WorkHubTable rows={rows} />
        </>
      ) : null}

      {showAttentionSummary ? (
        <RecordSection
          title="Needs attention"
          description="Start here. These are the items most likely to need a leader today."
        >
          {data.attention.length === 0 ? (
            <p className="m-0 text-[13.5px] text-ink-muted">
              Nothing is flagged right now — the queues are clear.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {data.attention.map((item) => (
                <li
                  key={item.id}
                  className="rounded-[8px] border border-line-soft px-3.5 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 flex min-w-0 flex-wrap items-center gap-2 text-[13.5px] font-semibold text-ink">
                      {item.entityType && item.entityId ? (
                        <EntityChip
                          type={item.entityType as Entity360Type}
                          id={item.entityId}
                          label={item.relatedLabel ?? item.title}
                          href={item.href}
                        />
                      ) : (
                        item.title
                      )}
                      <StatusBadge tone={SEVERITY_TONE[item.severity] ?? "info"}>
                        {item.ageLabel ?? item.kind.replaceAll("_", " ")}
                      </StatusBadge>
                    </p>
                    <a
                      href={item.href}
                      className="text-[12.5px] font-semibold text-brand-700 hover:underline"
                    >
                      Open →
                    </a>
                  </div>
                  <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
                    {item.why}
                    {item.suggestedStep ? (
                      <span className="font-medium text-ink"> {item.suggestedStep}</span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </RecordSection>
      ) : null}

      {view === "initiatives" ? (
        <RecordSection
          title="Initiatives"
          description="Initiatives with concrete reasons shown beside each status."
          action={
            <ButtonLink href="/operations/initiatives" variant="ghost" size="sm">
              Advanced initiative tools →
            </ButtonLink>
          }
        >
          {data.initiatives.length === 0 ? (
            <p className="m-0 text-[13.5px] text-ink-muted">
              No active initiatives are being tracked right now.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.initiatives.map((initiative) => (
                <CardV2 key={initiative.id} padding="md">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <EntityChip
                      type="initiative"
                      id={initiative.id}
                      label={initiative.title}
                      href={initiative.href}
                    />
                    <StatusBadge tone={initiative.healthTone}>
                      {initiative.healthLabel}
                    </StatusBadge>
                  </div>
                  {initiative.healthReasons.length > 0 ? (
                    <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                      {initiative.healthReasons.map((reason) => (
                        <li key={reason} className="text-[12.5px] text-ink-muted">
                          · {reason}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="m-0 mt-2 text-[12.5px] text-ink-muted">
                    {[
                      initiative.owner ? `Owner: ${initiative.owner}` : "No owner",
                      `${initiative.openActions} open action${initiative.openActions === 1 ? "" : "s"}`,
                      initiative.overdueActions > 0
                        ? `${initiative.overdueActions} overdue`
                        : null,
                      initiative.progressLabel,
                      initiative.targetDateISO
                        ? `${initiative.pastTargetDate ? "Target passed" : "Target"} ${fmtDay(initiative.targetDateISO)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {initiative.nextStep ? (
                    <p className="m-0 mt-1.5 text-[12.5px] text-ink">
                      <span className="font-semibold">Next:</span> {initiative.nextStep}
                    </p>
                  ) : null}
                </CardV2>
              ))}
            </div>
          )}
        </RecordSection>
      ) : null}

      {view === "actions" ? (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {/* Action System 4.0 — who owns what (accountability summary). */}
          <RecordSection
            title="Who owns what"
            description="Open actions per owner, with overdue and blocked work called out."
          >
            {data.accountability.length === 0 ? (
              <p className="m-0 text-[13.5px] text-ink-muted">No open actions.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {data.accountability.map((owner) => (
                  <li
                    key={owner.ownerId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-line-soft px-3.5 py-2"
                  >
                    <span className="text-[13.5px] font-semibold text-ink">
                      {owner.ownerName}
                    </span>
                    <span className="text-[12.5px] text-ink-muted">
                      {owner.open} open
                      {owner.overdue > 0 ? ` · ${owner.overdue} overdue` : ""}
                      {owner.blocked > 0 ? ` · ${owner.blocked} blocked` : ""}
                      {owner.oldestOverdueDays > 0
                        ? ` · oldest ${owner.oldestOverdueDays}d late`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </RecordSection>

          {/* Action System 4.0 — the weekly action review counts. */}
          <RecordSection
            title="This week"
            description="What changed this week, using only concrete counts."
          >
            <p className="m-0 text-[13.5px] text-ink">
              {data.weeklyReview.completedThisWeek} completed ·{" "}
              {data.weeklyReview.createdThisWeek} created (
              {data.weeklyReview.fromMeetingsThisWeek} from meetings) ·{" "}
              {data.weeklyReview.overdue} overdue · {data.weeklyReview.unowned} unowned
            </p>
            {data.weeklyReview.blockedNeedingEscalation.length > 0 ? (
              <div className="mt-2.5">
                <p className="m-0 text-[12.5px] font-semibold text-ink">
                  Blocked work needing escalation
                </p>
                <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
                  {data.weeklyReview.blockedNeedingEscalation.map((action) => (
                    <li key={action.id}>
                      <a
                        href={action.href}
                        className="text-[13px] text-brand-700 hover:underline"
                      >
                        {action.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </RecordSection>
        </div>
      ) : null}

      {view === "meetings" && data.decisionsWithoutActions.length > 0 ? (
        <RecordSection
          title="Decisions needing actions"
          description="Meeting decisions that still need someone assigned to carry them out."
        >
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {data.decisionsWithoutActions.map((decision) => (
              <li
                key={decision.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-line-soft px-3.5 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                  {decision.decision}
                </span>
                <a
                  href={decision.meetingHref}
                  className="text-[12.5px] font-semibold text-brand-700 hover:underline"
                >
                  {decision.meetingTitle} →
                </a>
              </li>
            ))}
          </ul>
        </RecordSection>
      ) : null}
    </div>
  );
}
