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
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { ActionTrackerTabs } from "@/components/people-strategy/action-tracker-tabs";
import { ActionCard } from "@/components/people-strategy/action-card";
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

const OVERDUE_ACCENT = "var(--error-color)";

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "14px 16px",
        flex: "1 1 150px",
        minWidth: 140,
        borderLeft: accent ? `3px solid ${OVERDUE_ACCENT}` : undefined,
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700, color: accent ? OVERDUE_ACCENT : "inherit" }}>
        {value}
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--ypp-ink)" }}>{title}</h2>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "12px 14px", fontSize: 13, color: "var(--muted)" }}>
      {children}
    </div>
  );
}

/** Compact deadline row used inside the "By Deadline" urgency buckets. */
function DeadlineRow({
  item,
  now,
}: {
  item: ActionItemWithRelations;
  now: Date;
}) {
  const overdue = isActionOverdue(item, now);
  return (
    <Link
      href={`/actions/${item.id}`}
      className="card my-actions-deadline-row"
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 14px",
        textDecoration: "none",
        color: "inherit",
        borderLeft: overdue
          ? `3px solid ${OVERDUE_ACCENT}`
          : "3px solid transparent",
      }}
    >
      <span style={{ fontSize: 13 }}>{item.title}</span>
      <span
        className="my-actions-deadline-date"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: overdue ? OVERDUE_ACCENT : "var(--muted)",
          whiteSpace: "nowrap",
        }}
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
  const hasOpenWork = URGENCY_BUCKET_ORDER.some(
    ({ key }) => urgency[key].length > 0
  );

  const lastUpdated = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  return (
    <div className="page-shell" style={{ maxWidth: 1040 }}>
      <ActionCommandBar
        eyebrow={`${session.user.name ?? "You"} · ${getUserTitle({
          primaryRole: viewer.primaryRole,
          adminSubtypes: viewer.adminSubtypes,
        })}`}
        title="My Actions"
        subtitle="Everything you lead, are executing, or owe input on — sorted by deadline."
        meta={`Last updated ${lastUpdated}`}
        actions={
          officer ? (
            <Link href="/actions/new" className="button small">
              + New Action
            </Link>
          ) : null
        }
      />

      {officer && <ActionTrackerTabs active="my" showPeople={showPeople} />}

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <StatCard label="Overdue" value={String(summary.overdue)} accent={summary.overdue > 0} />
        <StatCard label="In Progress" value={String(summary.inProgress)} />
        <StatCard label="Executing" value={String(summary.executing)} />
        <StatCard label="Needs Your Input" value={String(summary.needsInput)} />
        <StatCard
          label="Next Deadline"
          value={summary.nextDeadline ? formatDueDate(summary.nextDeadline) : "—"}
        />
      </div>

      {items.length === 0 ? (
        <div
          className="card"
          style={{
            marginTop: 16,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <p style={{ margin: 0 }}>
            You have no action items yet. When you&apos;re assigned as a lead, executor, or input,
            they&apos;ll appear here.
          </p>
          {officer ? (
            <Link
              href="/actions/new"
              className="button small"
              style={{ alignSelf: "flex-start" }}
            >
              + Create your first action
            </Link>
          ) : null}
        </div>
      ) : (
        <div
          className="my-actions-dashboard-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
            gap: 16,
            marginTop: 16,
            alignItems: "start",
          }}
        >
          {/* Left: You Are Executing */}
          <Panel title="You Are Executing">
            {executing.length === 0 ? (
              <EmptyNote>Nothing assigned to you to execute right now.</EmptyNote>
            ) : (
              executing.map((item) => (
                <ActionCard key={item.id} item={item} now={now} />
              ))
            )}
          </Panel>

          {/* Right column: Needs Your Input + Upcoming Deadlines */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Panel title="Needs Your Input">
              {needsInput.length === 0 ? (
                <EmptyNote>No one is waiting on your input.</EmptyNote>
              ) : (
                needsInput.map((item) => (
                  <ActionCard
                    key={item.id}
                    item={item}
                    now={now}
                    prompt={latestInputRequest(item, viewer.id)?.body ?? null}
                  />
                ))
              )}
            </Panel>

            <Panel title="By Deadline">
              {!hasOpenWork ? (
                <EmptyNote>No open deadlines ahead — you&apos;re all clear. 🎉</EmptyNote>
              ) : (
                URGENCY_BUCKET_ORDER.map(({ key, label }) => {
                  const bucket = urgency[key];
                  if (bucket.length === 0) return null;
                  const isOverdue = key === "overdue";
                  return (
                    <div
                      key={key}
                      style={{ display: "flex", flexDirection: "column", gap: 6 }}
                    >
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                          color: isOverdue ? OVERDUE_ACCENT : "var(--muted)",
                        }}
                      >
                        {label} · {bucket.length}
                      </p>
                      {bucket.map((item) => (
                        <DeadlineRow key={item.id} item={item} now={now} />
                      ))}
                    </div>
                  );
                })
              )}
            </Panel>
          </div>
        </div>
      )}

      {/* Teaching classes, surfaced alongside action items with a clear "Class"
          type label. Each row is read-only — class data is owned by the Classes
          system, not the Action Tracker. */}
      {teachingClasses.length > 0 ? (
        <section style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--ypp-ink)" }}>
            Your Classes
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
            Classes you teach as lead or executing instructor — read-only.
          </p>
          {teachingClasses.map((offering) => (
            <ClassTrackerRow key={offering.id} offering={offering} />
          ))}
        </section>
      ) : null}

      {/* Mentorship action items, surfaced from the Mentorship system so a
          mentor/mentee sees them next to their tracker work (#12). Read-only. */}
      {mentorshipActions.length > 0 ? (
        <section style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--ypp-ink)" }}>
            Mentorship Action Items
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
            Open tasks from your mentorship — managed in the Mentorship area.
          </p>
          {mentorshipActions.map((m) => (
            <div
              key={m.id}
              className="card"
              style={{
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 14 }}>{m.title}</strong>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {m.role === "owner" ? "Your task" : `For ${m.menteeName ?? "your mentee"}`}
                </div>
              </div>
              {m.dueAt ? (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Due {formatDueDate(m.dueAt)}
                </span>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
