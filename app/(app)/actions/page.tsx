import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled, isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { formatDueDate, formatDueDateLong } from "@/lib/leadership-action-center/dates";
import { getMyActionItems } from "@/lib/people-strategy/action-queries";
import {
  isLeadershipOrBoard,
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { getMyTeachingClasses } from "@/lib/people-strategy/class-tracker";
import { getMyMentorshipActionItems } from "@/lib/people-strategy/mentorship-my-actions";
import { ClassTrackerRow } from "@/components/people-strategy/class-tracker-row";
import { ActionListCard } from "@/components/people-strategy/action-list-card";
import { ActionTrackerTabsV2 } from "@/components/people-strategy/action-tracker-tabs-v2";
import {
  ButtonLink,
  cn,
  EmptyStateV2,
  PageHeaderV2,
  RecordSection,
} from "@/components/ui-v2";
import { getUserTitle } from "@/lib/user-title";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  bucketByUrgency,
  effectiveDeadline,
  isActionOverdue,
  latestInputRequest,
  selectExecuting,
  selectNeedsInput,
  sortByDeadline,
  summarizeMyActions,
  URGENCY_BUCKET_ORDER,
} from "@/lib/people-strategy/my-actions-selectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Actions · People Strategy" };

// Small colored dot keyed to each urgency bucket, so the "By Deadline" stack
// reads at a glance before the labels are even parsed.
const URGENCY_DOT: Record<string, string> = {
  overdue: "bg-danger-700",
  today: "bg-warning-700",
  thisWeek: "bg-brand-500",
  later: "bg-ink-muted",
};

/** A non-link stat tile (My Actions stats are informational, not filters). */
function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "danger" | "brand";
}) {
  return (
    <div
      className={cn(
        "min-w-[120px] flex-1 rounded-[12px] border bg-surface px-3.5 py-3 shadow-card",
        tone === "danger" ? "border-red-200" : "border-line-soft"
      )}
    >
      <p
        className={cn(
          "m-0 text-[22px] font-bold leading-tight",
          tone === "danger" ? "text-danger-700" : tone === "brand" ? "text-brand-700" : "text-ink"
        )}
      >
        {value}
      </p>
      <p className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
        {label}
      </p>
    </div>
  );
}

/** Compact deadline row used inside the "By Deadline" urgency buckets. */
function DeadlineRow({ item, now }: { item: ActionItemWithRelations; now: Date }) {
  const overdue = isActionOverdue(item, now);
  return (
    <Link
      href={`/actions/${item.id}`}
      className={cn(
        "flex items-center justify-between gap-2.5 rounded-[8px] border border-line-soft border-l-[3px] bg-surface px-3.5 py-2.5 no-underline transition-colors hover:border-brand-400",
        overdue ? "border-l-danger-700" : "border-l-transparent"
      )}
    >
      <span className="min-w-0 truncate text-[13px] text-ink">{item.title}</span>
      <span
        className={cn(
          "whitespace-nowrap text-[12px] font-semibold",
          overdue ? "text-danger-700" : "text-ink-muted"
        )}
      >
        {formatDueDateLong(effectiveDeadline(item))}
      </span>
    </Link>
  );
}

export default async function MyActionsPage() {
  // Feature flag is the outer gate: with ENABLE_ACTION_TRACKER off the route
  // does not exist to the app (hides route + any link pointing at it).
  if (!isActionTrackerEnabled()) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };

  const [rawItems, teachingClasses, mentorshipActions] = await Promise.all([
    getMyActionItems(viewer.id, viewer),
    getMyTeachingClasses(viewer.id),
    getMyMentorshipActionItems(viewer.id),
  ]);
  const items = sortByDeadline(rawItems);
  const now = new Date();
  const summary = summarizeMyActions(items, viewer.id, now);
  const officer = isOfficerTier(viewer);
  const showPeople = isPeopleDashboardEnabled() && isLeadershipOrBoard(viewer);

  const executing = selectExecuting(items, viewer.id);
  const needsInput = selectNeedsInput(items, viewer.id);
  const urgency = bucketByUrgency(items, now);
  const hasOpenWork = URGENCY_BUCKET_ORDER.some(({ key }) => urgency[key].length > 0);

  const lastUpdated = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5">
      <PageHeaderV2
        eyebrow={`${session.user.name ?? "You"} · ${getUserTitle({
          primaryRole: viewer.primaryRole,
          adminSubtypes: viewer.adminSubtypes,
        })} · Last updated ${lastUpdated}`}
        title="My Actions"
        subtitle="Everything you lead, are executing, or owe input on — sorted by deadline."
        actions={
          officer ? (
            <ButtonLink href="/actions/new" variant="primary" size="md">
              New action
            </ButtonLink>
          ) : null
        }
      >
        <div className="flex flex-wrap gap-3">
          <StatTile label="Overdue" value={summary.overdue} tone={summary.overdue > 0 ? "danger" : "default"} />
          <StatTile label="In progress" value={summary.inProgress} />
          <StatTile label="Executing" value={summary.executing} tone="brand" />
          <StatTile label="Needs your input" value={summary.needsInput} />
          <StatTile
            label="Next deadline"
            value={summary.nextDeadline ? formatDueDate(summary.nextDeadline) : "—"}
          />
        </div>
      </PageHeaderV2>

      {officer ? <ActionTrackerTabsV2 active="my" showPeople={showPeople} /> : null}

      {items.length === 0 ? (
        <EmptyStateV2
          icon="✅"
          title="No action items yet"
          body="When you're assigned as a lead, executor, or input, your work shows up here."
          action={
            officer ? (
              <ButtonLink href="/actions/new" variant="primary" size="sm">
                Create your first action
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <RecordSection title="You are executing">
            {executing.length === 0 ? (
              <p className="m-0 text-[13px] text-ink-muted">
                Nothing assigned to you to execute right now.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {executing.map((item) => (
                  <ActionListCard key={item.id} item={item} now={now} />
                ))}
              </div>
            )}
          </RecordSection>

          <div className="flex flex-col gap-4">
            <RecordSection title="Needs your input">
              {needsInput.length === 0 ? (
                <p className="m-0 text-[13px] text-ink-muted">
                  No one is waiting on your input.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {needsInput.map((item) => (
                    <ActionListCard
                      key={item.id}
                      item={item}
                      now={now}
                      prompt={latestInputRequest(item, viewer.id)?.body ?? null}
                    />
                  ))}
                </div>
              )}
            </RecordSection>

            <RecordSection title="By deadline">
              {!hasOpenWork ? (
                <p className="m-0 text-[13px] text-ink-muted">
                  No open deadlines ahead — you&apos;re all clear. 🎉
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {URGENCY_BUCKET_ORDER.map(({ key, label }) => {
                    const bucket = urgency[key];
                    if (bucket.length === 0) return null;
                    const isOverdue = key === "overdue";
                    return (
                      <div key={key} className="flex flex-col gap-1.5">
                        <p
                          className={cn(
                            "m-0 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em]",
                            isOverdue ? "text-danger-700" : "text-ink-muted"
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "size-[7px] shrink-0 rounded-full",
                              URGENCY_DOT[key] ?? "bg-ink-muted"
                            )}
                          />
                          {label} · {bucket.length}
                        </p>
                        {bucket.map((item) => (
                          <DeadlineRow key={item.id} item={item} now={now} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </RecordSection>
          </div>
        </div>
      )}

      {/* Teaching classes — read-only; class data is owned by the Classes
          system, surfaced here with a clear "Class" framing. */}
      {teachingClasses.length > 0 ? (
        <RecordSection
          title="Your classes"
          description="Classes you teach as lead or executing instructor — read-only."
        >
          <div className="flex flex-col gap-2">
            {teachingClasses.map((offering) => (
              <ClassTrackerRow key={offering.id} offering={offering} />
            ))}
          </div>
        </RecordSection>
      ) : null}

      {/* Mentorship action items — managed in the Mentorship area; read-only. */}
      {mentorshipActions.length > 0 ? (
        <RecordSection
          title="Mentorship action items"
          description="Open tasks from your mentorship — managed in the Mentorship area."
        >
          <div className="flex flex-col gap-2">
            {mentorshipActions.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line-soft bg-surface px-3.5 py-2.5 shadow-card"
              >
                <div className="min-w-0">
                  <strong className="text-[14px] text-ink">{m.title}</strong>
                  <div className="text-[12px] text-ink-muted">
                    {m.role === "owner" ? "Your task" : `For ${m.menteeName ?? "your mentee"}`}
                  </div>
                </div>
                {m.dueAt ? (
                  <span className="whitespace-nowrap text-[12px] font-semibold text-ink-muted">
                    Due {formatDueDate(m.dueAt)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </RecordSection>
      ) : null}
    </div>
  );
}
