import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled, isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { formatDueDate, formatDueDateLong } from "@/lib/leadership-action-center/dates";
import {
  getMyActionItems,
  type ActionItemWithRelations,
} from "@/lib/people-strategy/action-queries";
import {
  isCpoOrBoard,
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { ActionTrackerTabs } from "@/components/people-strategy/action-tracker-tabs";
import { getMyTeachingClasses } from "@/lib/people-strategy/class-tracker";
import { ClassTrackerRow } from "@/components/people-strategy/class-tracker-row";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { PriorityPill, StatusPill } from "@/components/people-strategy/pills";
import {
  effectiveDeadline,
  isActionOverdue,
  latestInputRequest,
  selectExecuting,
  selectNeedsInput,
  selectUpcoming,
  sortByDeadline,
  summarizeMyActions,
} from "@/lib/people-strategy/my-actions-selectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Actions · People Strategy" };

function formatRole(role: string | null | undefined): string {
  if (!role) return "Member";
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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

function ActionRow({
  item,
  userId,
  now,
  prompt,
}: {
  item: ActionItemWithRelations;
  userId: string;
  now: Date;
  prompt?: string | null;
}) {
  const overdue = isActionOverdue(item, now);
  const due = effectiveDeadline(item);
  return (
    <Link
      href={`/actions/${item.id}`}
      className="card"
      style={{
        display: "block",
        padding: "12px 14px",
        textDecoration: "none",
        color: "inherit",
        borderLeft: overdue ? `3px solid ${OVERDUE_ACCENT}` : "3px solid transparent",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <strong style={{ fontSize: 14 }}>{item.title}</strong>
        <span style={{ fontSize: 12, fontWeight: 600, color: overdue ? OVERDUE_ACCENT : "var(--muted)", whiteSpace: "nowrap" }}>
          {overdue ? "Overdue · " : "Due "}
          {formatDueDate(due)}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
        <StatusPill status={item.status} />
        <PriorityPill priority={item.priority} hideLow />
        <span style={{ fontSize: 12, color: "#64748b" }}>{item.department?.name ?? "—"}</span>
      </div>
      {prompt ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>
          &ldquo;{prompt}&rdquo;
        </p>
      ) : null}
    </Link>
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

  const [rawItems, teachingClasses] = await Promise.all([
    getMyActionItems(viewer.id, viewer),
    getMyTeachingClasses(viewer.id),
  ]);
  const items = sortByDeadline(rawItems);
  const now = new Date();
  const summary = summarizeMyActions(items, viewer.id, now);
  const officer = isOfficerTier(viewer);

  const executing = selectExecuting(items, viewer.id);
  const needsInput = selectNeedsInput(items, viewer.id);
  const upcoming = selectUpcoming(items).slice(0, 6);

  const lastUpdated = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  // Officers get the full Action Tracker tab bar (the same one every other
  // subview shows, so navigation is consistent — comment #17). Non-officers
  // only have My Actions, so no tab bar is rendered for them.
  const showPeople = isPeopleDashboardEnabled() && isCpoOrBoard(viewer);

  return (
    <div className="page-shell" style={{ maxWidth: 1040 }}>
      <ActionCommandBar
        eyebrow={`${session.user.name ?? "You"} · ${formatRole(viewer.primaryRole)}`}
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
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <p style={{ margin: 0 }}>
            You have no action items yet. When you&apos;re assigned as a lead, executor, or input,
            they&apos;ll appear here.
          </p>
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
                <ActionRow key={item.id} item={item} userId={viewer.id} now={now} />
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
                  <ActionRow
                    key={item.id}
                    item={item}
                    userId={viewer.id}
                    now={now}
                    prompt={latestInputRequest(item, viewer.id)?.body ?? null}
                  />
                ))
              )}
            </Panel>

            <Panel title="Your Upcoming Deadlines">
              {upcoming.length === 0 ? (
                <EmptyNote>No open deadlines ahead.</EmptyNote>
              ) : (
                upcoming.map((item) => {
                  const overdue = isActionOverdue(item, now);
                  return (
                    <Link
                      key={item.id}
                      href={`/actions/${item.id}`}
                      className="card my-actions-deadline-row"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "10px 14px",
                        textDecoration: "none",
                        color: "inherit",
                        borderLeft: overdue ? `3px solid ${OVERDUE_ACCENT}` : "3px solid transparent",
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
    </div>
  );
}
