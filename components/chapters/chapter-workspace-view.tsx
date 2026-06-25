import Link from "next/link";

import { CardV2, StatusBadge } from "@/components/ui-v2";
import {
  chapterLifecycleLabel,
  chapterLifecycleTone,
  isLaunchingStatus,
} from "@/lib/chapters/lifecycle";
import { CHAPTER_HEALTH_LABELS } from "@/lib/chapters/health";
import type { ChapterWorkspace } from "@/lib/chapters/workspace";

import { LaunchChecklist } from "@/components/chapters/launch-checklist";
import { ChapterSetupForm } from "@/components/chapters/chapter-setup-form";
import { SupportRequestsPanel } from "@/components/chapters/support-requests-panel";
import { ScheduleMeetingForm } from "@/components/chapters/schedule-meeting-form";
import { ChapterNotesPanel } from "@/components/chapters/chapter-notes-panel";
import { ChapterCheckInPanel } from "@/components/chapters/chapter-check-in-panel";
import { LifecycleControl } from "@/components/chapters/lifecycle-control";

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
}: {
  data: Data;
  canManage: boolean;
  isLeadership: boolean;
}) {
  const { chapter, health, nextStep, signals, launch, meetings, actions, supportRequests, notes, members, programs } =
    data;

  const kpis = [
    { label: "Members", value: signals.memberCount, detail: chapter.recruitmentGoal ? `goal ${chapter.recruitmentGoal}` : "" },
    { label: "Open actions", value: signals.openActions, detail: signals.overdueActions > 0 ? `${signals.overdueActions} overdue` : "on time" },
    { label: "Upcoming meetings", value: meetings.upcoming.length, detail: meetings.past.length ? `${meetings.past.length} held` : "none yet" },
    { label: "Programs", value: programs.courses.length, detail: `${programs.events.past.length} events run` },
    { label: "Launch", value: `${launch.progress.percent}%`, detail: `${launch.progress.done}/${launch.progress.total}` },
    { label: "Support", value: signals.openSupportRequests, detail: "open requests" },
  ];

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

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-line bg-surface px-3 py-2.5 shadow-card">
            <div className="text-[20px] font-bold text-ink">{k.value}</div>
            <div className="text-[12px] font-medium text-ink">{k.label}</div>
            {k.detail && <div className="text-[11px] text-ink-muted">{k.detail}</div>}
          </div>
        ))}
      </div>

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
            <Link href="/actions?who=all" className="text-[12.5px] font-semibold text-brand-700 hover:underline">
              Action tracker →
            </Link>
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

        {/* Programs */}
        <SectionCard title="Programs & classes">
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
