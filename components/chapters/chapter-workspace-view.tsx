import Link from "next/link";

import { CardV2, StatusBadge, StatCardV2 } from "@/components/ui-v2";
import { cn } from "@/components/ui-v2/cn";
import type { ChapterAttentionItem } from "@/lib/chapters/attention";
import type { ChapterClassOps } from "@/lib/chapters/class-ops";
import {
  chapterLifecycleLabel,
  chapterLifecycleTone,
  isLaunchingStatus,
} from "@/lib/chapters/lifecycle";
import {
  actionPrefillToQuery,
  buildActionPrefillFromChapter,
} from "@/lib/people-strategy/action-prefill";
import { CHAPTER_HEALTH_LABELS } from "@/lib/chapters/health";
import type { ChapterWorkspace } from "@/lib/chapters/workspace";

import { LaunchChecklist } from "@/components/chapters/launch-checklist";
import { ChapterSetupForm } from "@/components/chapters/chapter-setup-form";
import { SupportRequestsPanel } from "@/components/chapters/support-requests-panel";
import { ScheduleMeetingForm } from "@/components/chapters/schedule-meeting-form";
import { ChapterNotesPanel } from "@/components/chapters/chapter-notes-panel";
import { ChapterCheckInPanel } from "@/components/chapters/chapter-check-in-panel";
import { LifecycleControl } from "@/components/chapters/lifecycle-control";
import { EntityWorkflowCard } from "@/components/workflow-engine/entity-workflow-card";

type Data = NonNullable<ChapterWorkspace>;

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

const ACTION_STATUS_TONE: Record<string, "neutral" | "warning" | "danger" | "success"> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "warning",
  BLOCKED: "danger",
  OVERDUE: "danger",
  COMPLETE: "success",
  DROPPED: "neutral",
};

const ATTENTION_TONE: Record<ChapterAttentionItem["tone"], { chip: string; badge: string }> = {
  danger: {
    chip: "border-danger-700/30 bg-danger-700/10 text-danger-700 hover:border-danger-700/50",
    badge: "bg-danger-700 text-white",
  },
  warning: {
    chip: "border-progress-700/30 bg-progress-700/10 text-progress-700 hover:border-progress-700/50",
    badge: "bg-progress-700 text-white",
  },
  brand: {
    chip: "border-brand-300 bg-brand-50 text-brand-700 hover:border-brand-400",
    badge: "bg-brand-600 text-white",
  },
};

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <CardV2 padding="md" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </CardV2>
  );
}

export function ChapterWorkspaceView({
  data,
  canManage,
  isLeadership,
  attention,
  classOps,
}: {
  data: Data;
  canManage: boolean;
  isLeadership: boolean;
  /**
   * CP daily-ops triage. Provided on the Chapter President home so the queues
   * that need them (recruiting, curriculum, join requests, overdue work) live
   * inline; omitted on the leadership chapter detail, which has its own tools.
   */
  attention?: ChapterAttentionItem[];
  /**
   * Chapter-scoped class operations + instructor coverage. Provided on the CP
   * home so a President can see how their classes are staffed without the
   * admin console; omitted on the leadership detail.
   */
  classOps?: ChapterClassOps;
}) {
  const { chapter, health, nextStep, signals, launch, meetings, actions, supportRequests, notes, members, programs } =
    data;

  const instructorCount = members.filter((m) => m.roles.includes("INSTRUCTOR")).length;
  const studentCount = members.filter((m) => m.roles.includes("STUDENT")).length;

  const showLaunch = launch.items.length > 0 || isLaunchingStatus(chapter.lifecycleStatus);

  return (
    <div className="flex flex-col gap-5">
      {/* Status band */}
      <CardV2 padding="md" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-bold text-ink">{chapter.name}</h1>
              <StatusBadge tone={chapterLifecycleTone(chapter.lifecycleStatus)}>
                {chapterLifecycleLabel(chapter.lifecycleStatus)}
              </StatusBadge>
              <StatusBadge tone={health.tone} withDot title={health.reasons.join("; ")}>
                {CHAPTER_HEALTH_LABELS[health.label]}
              </StatusBadge>
            </div>
            <p className="text-[13px] text-ink-muted">
              {[chapter.city, chapter.state].filter(Boolean).join(", ") || "Location not set"}
              {chapter.partnerSchool ? ` · ${chapter.partnerSchool}` : ""}
            </p>
            <p className="text-[13px] text-ink">
              <span className="text-ink-muted">President:</span> {chapter.president?.name ?? "Unassigned"}
              {chapter.facultyAdvisorName ? (
                <>
                  {" "}
                  · <span className="text-ink-muted">Advisor:</span> {chapter.facultyAdvisorName}
                </>
              ) : null}
            </p>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Next step</p>
            <p className="text-[14px] font-semibold text-brand-900">{nextStep}</p>
          </div>
        </div>

        {health.reasons.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-muted">
            {health.reasons.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        )}

        {isLeadership && (
          <div className="border-t border-line-soft pt-3">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
              Leadership: lifecycle stage
            </p>
            <LifecycleControl
              chapterId={chapter.id}
              status={chapter.lifecycleStatus}
              note={chapter.lifecycleNote ?? ""}
            />
          </div>
        )}
      </CardV2>

      {/* Needs your attention — the daily-ops queues, as chips that link
          straight into the workflow that clears each one. Only on the CP home
          (attention is passed there); empty is a calm "all caught up". */}
      {attention && (
        <CardV2 padding="md" className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold text-ink">Needs your attention</h2>
            <span className="text-[12px] text-ink-muted">
              {attention.length === 0
                ? "All caught up"
                : `${attention.length} ${attention.length === 1 ? "item" : "items"}`}
            </span>
          </div>
          {attention.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              No queues need you right now — recruiting, curriculum, join requests, and actions are clear.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {attention.map((item) => {
                const tone = ATTENTION_TONE[item.tone];
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                      tone.chip
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                        tone.badge
                      )}
                    >
                      {item.count}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </CardV2>
      )}

      {/* Metric strip — clickable into each chapter surface. CP home only; the
          leadership chapter detail renders its own admin KPI rows below. */}
      {!isLeadership && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <StatCardV2
            label="Members"
            value={members.length}
            href="/chapter/members"
            detail={chapter.recruitmentGoal ? `goal ${chapter.recruitmentGoal}` : undefined}
          />
          <StatCardV2 label="Instructors" value={instructorCount} href="/chapter/instructors" />
          <StatCardV2 label="Students" value={studentCount} href="/chapter/students" />
          <StatCardV2
            label="Open actions"
            value={signals.openActions}
            href={`/actions?ch=${chapter.id}`}
            detail={signals.overdueActions > 0 ? `${signals.overdueActions} overdue` : "on time"}
            accent={signals.overdueActions > 0 ? "danger" : undefined}
            tone={signals.overdueActions > 0 ? "attention" : "default"}
          />
          <StatCardV2
            label="Meetings"
            value={meetings.upcoming.length}
            href="/meetings"
            detail={meetings.past.length ? `${meetings.past.length} held` : "none scheduled"}
          />
        </div>
      )}

      {showLaunch && (
        <SectionCard title="Launch checklist">
          {launch.items.length > 0 ? (
            <LaunchChecklist
              chapterId={chapter.id}
              canManage={canManage}
              isLeadership={isLeadership}
              progress={launch.progress}
              items={launch.items.map((i) => ({
                id: i.id,
                key: i.key,
                title: i.title,
                description: i.description,
                owner: i.owner,
                leadershipOnly: i.leadershipOnly,
                ownerLabel: i.ownerLabel,
                dueDate: i.dueDate ? i.dueDate.toISOString() : null,
                done: i.done,
              }))}
            />
          ) : (
            <p className="text-[13px] text-ink-muted">
              The launch checklist seeds automatically when the chapter starts launching.
            </p>
          )}
        </SectionCard>
      )}

      {/* Classes & coverage — chapter-scoped class operations the CP used to be
          locked out of: which classes are staffed, which need attention, and
          what's pending approval. Links into the existing coverage cockpit. */}
      {classOps && (
        <SectionCard
          title="Classes & coverage"
          action={
            <Link
              href="/operations/instructor-pairing"
              className="text-[12.5px] font-semibold text-brand-700 hover:underline"
            >
              Coverage cockpit →
            </Link>
          }
        >
          {classOps.total === 0 ? (
            <p className="text-[13px] text-ink-muted">No classes scheduled for this chapter yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-muted">
                <span>
                  {classOps.total} {classOps.total === 1 ? "class" : "classes"}
                </span>
                {classOps.needsStaffing > 0 && (
                  <span className="font-semibold text-progress-700">
                    {classOps.needsStaffing} need staffing
                  </span>
                )}
                {classOps.pendingApproval > 0 && (
                  <span className="font-semibold text-progress-700">
                    {classOps.pendingApproval} pending approval
                  </span>
                )}
              </div>
              <ul className="flex flex-col gap-1.5">
                {classOps.rows.slice(0, 8).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{c.title}</span>
                    <span className="flex flex-shrink-0 items-center gap-2">
                      <span className="text-[12px] text-ink-muted">{c.enrolled} enrolled</span>
                      <StatusBadge tone={c.covered ? "success" : "warning"}>{c.coverageLabel}</StatusBadge>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>
      )}

      {/* Chapter workflows — the active playbook(s) running for this chapter
          (launch, health recovery, etc.), with stage, health reason, and next
          step, so a CP always knows what to do next and why. */}
      <EntityWorkflowCard
        entityType="CHAPTER"
        entityId={chapter.id}
        chapterId={chapter.id}
        title="Chapter workflows"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Meetings */}
        <SectionCard
          title="Meetings"
          action={
            <Link href="/meetings" className="text-[12.5px] font-semibold text-brand-700 hover:underline">
              All meetings →
            </Link>
          }
        >
          {canManage && <ScheduleMeetingForm chapterId={chapter.id} />}
          {meetings.upcoming.length === 0 && meetings.past.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No meetings yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {[...meetings.upcoming, ...meetings.past].slice(0, 8).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <Link href={`/meetings/${m.id}`} className="font-medium text-brand-800 hover:underline">
                    {m.title}
                  </Link>
                  <span className="text-[12px] text-ink-muted">{fmtDate(m.scheduledAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Actions */}
        <SectionCard
          title="Actions"
          action={
            <div className="flex items-center gap-3">
              {canManage && (
                <Link
                  href={actionPrefillToQuery(
                    buildActionPrefillFromChapter({
                      chapterId: chapter.id,
                      suggestedOwnerId: chapter.president?.id ?? null,
                    })
                  )}
                  className="text-[12.5px] font-semibold text-brand-700 hover:underline"
                >
                  + New action
                </Link>
              )}
              <Link href={`/actions?ch=${chapter.id}`} className="text-[12.5px] font-semibold text-brand-700 hover:underline">
                Action tracker →
              </Link>
            </div>
          }
        >
          {actions.open.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No open chapter actions.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {actions.open.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <Link href={`/actions/${a.id}`} className="min-w-0 flex-1 truncate font-medium text-ink hover:underline">
                    {a.title}
                  </Link>
                  <StatusBadge tone={ACTION_STATUS_TONE[a.status] ?? "neutral"}>
                    {a.status.replace(/_/g, " ").toLowerCase()}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Members */}
        <SectionCard title={`Members (${members.length})`}>
          {members.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No members yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-ink-muted">
                    <th className="py-1.5 pr-2 font-semibold">Name</th>
                    <th className="py-1.5 pr-2 font-semibold">Role</th>
                    <th className="py-1.5 pr-2 font-semibold">Attended</th>
                  </tr>
                </thead>
                <tbody>
                  {members.slice(0, 25).map((m) => (
                    <tr key={m.id} className="border-b border-line-soft">
                      <td className="py-1.5 pr-2">
                        <Link href={`/people/${m.id}`} className="font-medium text-brand-800 hover:underline">
                          {m.name}
                        </Link>
                        {m.isPresident && <span className="ml-1 text-[11px] text-brand-600">★ CP</span>}
                      </td>
                      <td className="py-1.5 pr-2 text-ink-muted">{m.role.replace(/_/g, " ").toLowerCase()}</td>
                      <td className="py-1.5 pr-2 text-ink-muted">{m.meetingsAttended}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Courses & events */}
        <SectionCard title="Courses & events">
          {programs.courses.length === 0 && programs.events.upcoming.length === 0 && programs.events.past.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No programs or classes yet.</p>
          ) : (
            <div className="flex flex-col gap-2 text-[13px]">
              {programs.courses.slice(0, 6).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink">{c.title}</span>
                  <span className="text-[12px] text-ink-muted">{c._count.enrollments} enrolled</span>
                </div>
              ))}
              {programs.events.upcoming.slice(0, 4).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2">
                  <span className="text-ink">{e.title}</span>
                  <span className="text-[12px] text-ink-muted">{fmtDate(e.startDate)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Check-in — lightweight, flows into notes + actions + lifecycle */}
      {canManage && (
        <SectionCard title="Check-in">
          <ChapterCheckInPanel chapterId={chapter.id} isLeadership={isLeadership} />
        </SectionCard>
      )}

      {/* Setup (collapsible) */}
      {canManage && (
        <details className="rounded-[14px] border border-line-card bg-surface p-5 shadow-card">
          <summary className="cursor-pointer text-[15px] font-bold text-ink">Chapter setup</summary>
          <div className="mt-3">
            <ChapterSetupForm
              initial={{
                chapterId: chapter.id,
                city: chapter.city ?? "",
                state: chapter.state ?? "",
                schoolType: chapter.schoolType ?? "",
                partnerSchool: chapter.partnerSchool ?? "",
                facultyAdvisorName: chapter.facultyAdvisorName ?? "",
                facultyAdvisorEmail: chapter.facultyAdvisorEmail ?? "",
                foundingTeamNotes: chapter.foundingTeamNotes ?? "",
                recruitmentGoal: chapter.recruitmentGoal != null ? String(chapter.recruitmentGoal) : "",
                supportNeeded: chapter.supportNeeded ?? "",
                launchTargetDate: toDateInput(chapter.launchTargetDate),
                expectedFirstMeetingAt: toDateInput(chapter.expectedFirstMeetingAt),
              }}
            />
          </div>
        </details>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Support requests */}
        <SectionCard title="Support requests">
          <SupportRequestsPanel
            chapterId={chapter.id}
            canRequest={canManage}
            isLeadership={isLeadership}
            requests={supportRequests.map((r) => ({
              id: r.id,
              category: r.category,
              title: r.title,
              details: r.details,
              status: r.status,
              priority: r.priority,
              createdAt: r.createdAt.toISOString(),
              requestedBy: r.requestedBy,
              assignedTo: r.assignedTo,
              resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
            }))}
          />
        </SectionCard>

        {/* Notes */}
        <SectionCard title="Leadership notes">
          <ChapterNotesPanel
            chapterId={chapter.id}
            canWrite={isLeadership}
            notes={notes
              .filter((n) => isLeadership || n.audience === "CHAPTER")
              .map((n) => ({
                id: n.id,
                body: n.body,
                audience: n.audience,
                pinned: n.pinned,
                createdAt: n.createdAt.toISOString(),
                author: n.author,
              }))}
          />
        </SectionCard>
      </div>
    </div>
  );
}
