import Link from "next/link";

import { ClassSettingsPanel } from "@/components/instructor/class-settings-panel";
import { ClassworkPanel } from "@/components/instructor/classwork-panel";
import {
  AnnouncementComposer,
  AttendanceReviewResponse,
  StudentFeedbackPanel,
} from "@/components/session8/instructor-class-widgets";
import { formatClassScheduleLabel } from "@/lib/classes/format-schedule-label";
import { dateTime } from "@/lib/session8/format";
import { classAnnouncementStatusLabel } from "@/lib/session8/labels";
import { formatEasternDateTime } from "@/lib/timezone-eastern";

const DEFAULT_THEME = "#6b21c8";

const ATTENDANCE_STATE_LABEL: Record<string, string> = {
  MISSING: "Take attendance",
  PARTIAL: "Started",
  RECORDED: "Saved",
  FINALIZED: "Done",
  "N/A": "Coming up",
};

/** Split "Course — Cohort detail" into a short main title + optional detail. */
function splitClassTitle(title: string): { main: string; detail: string | null } {
  const parts = title.split(/\s+[—–-]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { main: parts[0]!, detail: parts.slice(1).join(" — ") };
  }
  return { main: title.trim() || "Class", detail: null };
}

/** "Cohort A · Session 4" → "Class 4" so the feed stays easy to scan. */
function friendlySessionTitle(topic: string): string {
  const cleaned = topic.trim();
  const match = cleaned.match(/(?:^|[·\-—,])\s*Session\s+(\d+)\s*$/i);
  if (match) return `Class ${match[1]}`;
  const only = cleaned.match(/^Session\s+(\d+)$/i);
  if (only) return `Class ${only[1]}`;
  return cleaned || "Class";
}

type StreamClass = {
  id: string;
  title: string;
  status: string;
  meetingDays: string[];
  meetingTime: string | null;
  themeColor?: string | null;
  enrollmentOpen?: boolean;
  semester?: string | null;
  template?: { title: string } | null;
  chapter?: { name: string } | null;
  partner?: { name: string } | null;
  roster: Array<{
    id: string;
    studentId: string;
    status: string;
    student?: {
      name: string | null;
      primaryRole?: string | null;
      profile?: { grade?: string | null } | null;
    } | null;
  }>;
  sessions: Array<{
    id: string;
    topic: string;
    date: string | Date;
    startTime?: string | null;
    isCancelled?: boolean;
    materialsUrl?: string | null;
  }>;
  announcements?: Array<{
    id: string;
    title?: string | null;
    body: string;
    status: string;
    audience: string;
    createdAt: string | Date;
    scheduledPublishAt?: string | Date | null;
    publishedAt?: string | Date | null;
  }>;
  sessionAttendanceState: Array<{ sessionId: string; state: string }>;
  openReviewRequests: Array<{
    id: string;
    sessionDate: string | Date | null;
    externalStatus: string;
  }>;
  instructorFeedback: Array<{
    id: string;
    studentId: string;
    body: string;
    strengths?: string | null;
    growthAreas?: string | null;
    releasedToFamilyAt?: string | Date | null;
  }>;
  classParents?: Array<{
    id: string;
    parentId: string;
    name: string | null;
    email: string | null;
    primaryRole?: string | null;
    relationship: string;
    studentId: string;
    studentName: string | null;
  }>;
  instructor?: {
    id: string;
    name: string | null;
    email?: string | null;
  } | null;
  regularInstructorAssignments?: Array<{
    id: string;
    role: string;
    instructor: {
      id: string;
      name: string | null;
      email?: string | null;
    };
  }>;
  assignments?: Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    attachmentUrl?: string | null;
    suggestedDueDate?: string | Date | null;
    sessionId?: string | null;
    createdAt: string | Date;
    isPublished?: boolean;
  }>;
  offeringEnded: boolean;
  alreadyCompleted: boolean;
};

/**
 * Instructor class home: banner, Home / Work / People / Settings,
 * message bar + feed, upcoming sidebar.
 */
export function ClassClassroomHome({
  c,
  tab = "home",
}: {
  c: StreamClass;
  tab?: "home" | "people" | "classwork" | "settings";
}) {
  const id = c.id;
  const theme =
    c.themeColor && /^#[0-9a-fA-F]{6}$/.test(c.themeColor)
      ? c.themeColor
      : DEFAULT_THEME;
  const now = new Date();
  const currentStudents = c.roster.filter((e) => e.status === "ENROLLED");
  const currentStudentIds = new Set(currentStudents.map((e) => e.studentId));
  const currentParents = (c.classParents ?? []).filter((p) =>
    currentStudentIds.has(p.studentId),
  );
  const instructors = buildClassInstructors(c);
  const next = c.sessions.find(
    (s) => !s.isCancelled && new Date(s.date) >= now
  );
  const attendanceBySession = new Map(
    c.sessionAttendanceState.map((a) => [a.sessionId, a.state])
  );
  const { main: titleMain, detail: titleDetail } = splitClassTitle(c.title);
  const schedule = formatClassScheduleLabel({
    meetingDays: c.meetingDays ?? [],
    meetingTime: c.meetingTime,
  });
  const subtitle = [titleDetail, schedule].filter(Boolean).join(" · ");

  const upcomingSessions = c.sessions
    .filter((s) => !s.isCancelled && new Date(s.date) >= now)
    .slice(0, 4);

  const streamItems = buildStream(c, attendanceBySession);

  const tabs = [
    { id: "home" as const, label: "Home", href: `/instructor/classes/${id}` },
    {
      id: "classwork" as const,
      label: "Work",
      href: `/instructor/classes/${id}?tab=classwork`,
    },
    {
      id: "people" as const,
      label: "People",
      href: `/instructor/classes/${id}?tab=people`,
    },
    {
      id: "settings" as const,
      label: "Settings",
      href: `/instructor/classes/${id}?tab=settings`,
    },
  ];

  return (
    <div className="-mx-0 min-h-[calc(100vh-4rem)] bg-[#f8f9fa]">
      <div className="border-b border-black/5" style={{ backgroundColor: theme }}>
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-6 sm:px-6">
          <Link
            href="/instructor/classes"
            className="text-[13px] font-medium text-white/80 no-underline hover:text-white"
          >
            ← Classes
          </Link>
          <h1 className="mt-3 max-w-3xl text-[28px] font-normal leading-tight tracking-[-0.02em] text-white sm:text-[34px]">
            {titleMain}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-[14px] text-white/85">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="sticky top-0 z-10 border-b border-[#e0e0e0] bg-white">
        <nav
          className="mx-auto flex max-w-5xl gap-1 px-4 sm:px-6"
          aria-label="Class sections"
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <Link
                key={t.id}
                href={t.href}
                className={
                  active
                    ? "border-b-[3px] px-4 py-3 text-[14px] font-medium no-underline"
                    : "border-b-[3px] border-transparent px-4 py-3 text-[14px] font-medium text-[#5f6368] no-underline hover:bg-[#f1f3f4] hover:text-[#202124]"
                }
                style={
                  active
                    ? { borderBottomColor: theme, color: theme }
                    : undefined
                }
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {tab === "home" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-[#e0e0e0] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
                <AnnouncementComposer offeringId={id} />
              </div>

              {c.openReviewRequests.length > 0 ? (
                <div className="rounded-xl border border-[#f9ab00]/40 bg-[#fef7e0] px-4 py-3">
                  <p className="m-0 text-[14px] font-medium text-[#202124]">
                    {c.openReviewRequests.length} attendance check
                    {c.openReviewRequests.length === 1 ? "" : "s"} waiting
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {c.openReviewRequests.map((r) => (
                      <div key={r.id} className="text-[13px] text-[#5f6368]">
                        {r.sessionDate
                          ? new Date(r.sessionDate).toLocaleDateString()
                          : "A class"}{" "}
                        · {r.externalStatus}
                        <AttendanceReviewResponse requestId={r.id} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {streamItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#dadce0] bg-white px-6 py-10 text-center">
                  <p className="m-0 text-[15px] text-[#5f6368]">
                    Nothing here yet. Post a message or open the next class.
                  </p>
                  {next ? (
                    <Link
                      href={`/instructor/classes/${id}/sessions/${next.id}`}
                      className="mt-4 inline-flex rounded-full bg-[#1967d2] px-4 py-2 text-[13px] font-medium text-white no-underline hover:bg-[#1557b0]"
                    >
                      Open next class
                    </Link>
                  ) : null}
                </div>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {streamItems.map((item) => (
                    <li key={item.key}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="block rounded-xl border border-[#e0e0e0] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.08)] no-underline transition hover:border-[#dadce0] hover:shadow-[0_1px_3px_rgba(60,64,67,0.16)]"
                        >
                          <StreamCardBody item={item} />
                        </Link>
                      ) : (
                        <div className="rounded-xl border border-[#e0e0e0] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
                          <StreamCardBody item={item} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <aside className="flex flex-col gap-4">
              <div className="rounded-xl border border-[#e0e0e0] bg-white p-4">
                <p className="m-0 text-[14px] font-medium text-[#202124]">
                  Coming up
                </p>
                {upcomingSessions.length === 0 ? (
                  <p className="m-0 mt-2 text-[13px] text-[#5f6368]">
                    Nothing coming up.
                  </p>
                ) : (
                  <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
                    {upcomingSessions.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/instructor/classes/${id}/sessions/${s.id}`}
                          className="block no-underline"
                        >
                          <p className="m-0 text-[13px] font-medium text-[#1967d2]">
                            {friendlySessionTitle(s.topic)}
                          </p>
                          <p className="m-0 mt-0.5 text-[12px] text-[#5f6368]">
                            {dateTime(s.date, s.startTime)}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-[#e0e0e0] bg-white p-4">
                <p className="m-0 text-[14px] font-medium text-[#202124]">About</p>
                <dl className="m-0 mt-3 flex flex-col gap-2 text-[13px]">
                  <div>
                    <dt className="text-[#5f6368]">Students</dt>
                    <dd className="m-0 font-medium text-[#202124]">
                      <Link
                        href={`/instructor/classes/${id}/roster`}
                        className="text-[#1967d2] no-underline hover:underline"
                      >
                        {currentStudents.length}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#5f6368]">Chapter</dt>
                    <dd className="m-0 text-[#202124]">
                      {c.chapter?.name ?? "YPP"}
                    </dd>
                  </div>
                  {c.partner?.name ? (
                    <div>
                      <dt className="text-[#5f6368]">Partner</dt>
                      <dd className="m-0 text-[#202124]">{c.partner.name}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </aside>
          </div>
        ) : null}

        {tab === "people" ? (
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="m-0 text-[18px] font-normal text-[#202124]">
                People
              </h2>
              <Link
                href={`/instructor/classes/${id}/roster`}
                className="text-[13px] font-medium text-[#1967d2] no-underline hover:underline"
              >
                Edit list →
              </Link>
            </div>

            <h3 className="m-0 mb-2 text-[13px] font-medium uppercase tracking-[0.06em] text-[#5f6368]">
              Instructors ({instructors.length})
            </h3>
            {instructors.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#dadce0] bg-white px-4 py-6 text-center text-[14px] text-[#5f6368]">
                No instructors listed yet.
              </p>
            ) : (
              <ul className="m-0 mb-8 divide-y divide-[#e0e0e0] overflow-hidden rounded-xl border border-[#e0e0e0] bg-white p-0">
                {instructors.map((person) => (
                  <li key={person.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e6f4ea] text-[13px] font-medium text-[#137333]"
                    >
                      {initials(person.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[14px] font-medium text-[#202124]">
                        {person.name ?? "Instructor"}
                      </p>
                      <p className="m-0 text-[12px] text-[#5f6368]">{person.roleLabel}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="m-0 mb-2 text-[13px] font-medium uppercase tracking-[0.06em] text-[#5f6368]">
              Students ({currentStudents.length})
            </h3>
            {currentStudents.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#dadce0] bg-white px-4 py-8 text-center text-[14px] text-[#5f6368]">
                No students yet.
              </p>
            ) : (
              <ul className="m-0 divide-y divide-[#e0e0e0] overflow-hidden rounded-xl border border-[#e0e0e0] bg-white p-0">
                {currentStudents.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[13px] font-medium text-[#1967d2]"
                    >
                      {initials(e.student?.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[14px] font-medium text-[#202124]">
                        {e.student?.name ?? "Student"}
                      </p>
                      <p className="m-0 text-[12px] text-[#5f6368]">
                        {studentSubtitle(e.student)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="m-0 mb-2 mt-8 text-[13px] font-medium uppercase tracking-[0.06em] text-[#5f6368]">
              Parents ({currentParents.length})
            </h3>
            {currentParents.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#dadce0] bg-white px-4 py-6 text-center text-[14px] text-[#5f6368]">
                No parents linked yet.
              </p>
            ) : (
              <ul className="m-0 divide-y divide-[#e0e0e0] overflow-hidden rounded-xl border border-[#e0e0e0] bg-white p-0">
                {currentParents.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fce8e6] text-[13px] font-medium text-[#c5221f]"
                    >
                      {initials(p.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[14px] font-medium text-[#202124]">
                        {p.name ?? "Parent"}
                      </p>
                      <p className="m-0 text-[12px] text-[#5f6368]">
                        Parent
                        {p.studentName ? ` · ${p.studentName}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <details className="mt-6 rounded-xl border border-[#e0e0e0] bg-white">
              <summary className="cursor-pointer list-none px-4 py-3 text-[14px] font-medium text-[#202124] marker:content-none [&::-webkit-details-marker]:hidden">
                Feedback
              </summary>
              <div className="border-t border-[#e0e0e0] px-4 py-3">
                <StudentFeedbackPanel
                  offeringId={id}
                  students={currentStudents.map((e) => ({
                    id: e.studentId,
                    name: e.student?.name ?? null,
                  }))}
                  feedback={c.instructorFeedback}
                />
              </div>
            </details>
          </div>
        ) : null}

        {tab === "classwork" ? (
          <ClassworkPanel
            offeringId={id}
            sessions={c.sessions}
            assignments={c.assignments ?? []}
            offeringEnded={c.offeringEnded}
            alreadyCompleted={c.alreadyCompleted}
          />
        ) : null}

        {tab === "settings" ? (
          <ClassSettingsPanel
            offeringId={id}
            title={c.title}
            themeColor={c.themeColor}
            enrollmentOpen={c.enrollmentOpen ?? true}
            semester={c.semester}
            meetingDays={c.meetingDays ?? []}
            meetingTime={c.meetingTime}
          />
        ) : null}
      </div>
    </div>
  );
}

type StreamItem = {
  key: string;
  kind: "session" | "announcement";
  title: string;
  meta: string;
  body?: string;
  href?: string;
  badge?: string;
  sortAt: number;
};

function StreamCardBody({ item }: { item: StreamItem }) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className={
          item.kind === "announcement"
            ? "mt-0.5 flex h-9 shrink-0 items-center justify-center rounded-full bg-[#e6f4ea] px-2.5 text-[11px] font-semibold text-[#137333]"
            : "mt-0.5 flex h-9 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] px-2.5 text-[11px] font-semibold text-[#1967d2]"
        }
      >
        {item.kind === "announcement" ? "Post" : "Class"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="m-0 text-[14px] font-medium text-[#202124]">
            {item.title}
          </p>
          {item.badge ? (
            <span className="text-[12px] text-[#5f6368]">{item.badge}</span>
          ) : null}
        </div>
        <p className="m-0 mt-0.5 text-[12px] text-[#5f6368]">{item.meta}</p>
        {item.body ? (
          <p className="m-0 mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[#3c4043]">
            {item.body}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function initials(name: string | null | undefined) {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function instructorRoleLabel(role: string | null | undefined) {
  switch (role) {
    case "LEAD":
      return "Lead instructor";
    case "CO_INSTRUCTOR":
      return "Co-instructor";
    case "ASSISTANT":
      return "Assistant";
    case "BACKUP":
      return "Backup instructor";
    default:
      return "Instructor";
  }
}

function buildClassInstructors(c: StreamClass): Array<{
  id: string;
  name: string | null;
  roleLabel: string;
}> {
  const byId = new Map<string, { id: string; name: string | null; roleLabel: string; rank: number }>();

  const put = (id: string, name: string | null, role: string | null | undefined, rank: number) => {
    const existing = byId.get(id);
    if (existing && existing.rank <= rank) return;
    byId.set(id, {
      id,
      name,
      roleLabel: instructorRoleLabel(role),
      rank,
    });
  };

  if (c.instructor?.id) {
    put(c.instructor.id, c.instructor.name, "LEAD", 0);
  }

  for (const assignment of c.regularInstructorAssignments ?? []) {
    const person = assignment.instructor;
    if (!person?.id) continue;
    const rank =
      assignment.role === "LEAD"
        ? 0
        : assignment.role === "CO_INSTRUCTOR"
          ? 1
          : assignment.role === "ASSISTANT"
            ? 2
            : 3;
    put(person.id, person.name, assignment.role, rank);
  }

  return Array.from(byId.values())
    .sort((a, b) => a.rank - b.rank || (a.name ?? "").localeCompare(b.name ?? ""))
    .map(({ id, name, roleLabel }) => ({ id, name, roleLabel }));
}

function studentSubtitle(student: {
  primaryRole?: string | null;
  profile?: { grade?: string | null } | null;
} | null | undefined) {
  const grade = student?.profile?.grade?.trim();
  if (grade) return grade.startsWith("Grade") ? grade : `Grade ${grade}`;
  return "Student";
}

function buildStream(
  c: StreamClass,
  attendanceBySession: Map<string, string>
): StreamItem[] {
  const items: StreamItem[] = [];

  for (const a of c.announcements ?? []) {
    const scheduledLabel = formatEasternDateTime(a.scheduledPublishAt ?? null);
    const when =
      a.status === "SCHEDULED" && scheduledLabel
        ? `Posts ${scheduledLabel}`
        : formatEasternDateTime(a.publishedAt ?? a.createdAt) ??
          new Date(a.createdAt).toLocaleDateString();
    items.push({
      key: `ann-${a.id}`,
      kind: "announcement",
      title: a.title?.trim() || "Message",
      meta: `${simpleAnnouncementStatus(a.status)} · ${when}`,
      body: a.body,
      sortAt: new Date(a.scheduledPublishAt ?? a.createdAt).getTime(),
    });
  }

  for (const s of c.sessions.filter((x) => !x.isCancelled).slice(0, 8)) {
    const state = attendanceBySession.get(s.id) ?? "N/A";
    items.push({
      key: `ses-${s.id}`,
      kind: "session",
      title: friendlySessionTitle(s.topic),
      meta: dateTime(s.date, s.startTime),
      href: `/instructor/classes/${c.id}/sessions/${s.id}`,
      badge: ATTENDANCE_STATE_LABEL[state] ?? state,
      body: undefined,
      sortAt: new Date(s.date).getTime(),
    });
  }

  return items.sort((a, b) => b.sortAt - a.sortAt);
}

function simpleAnnouncementStatus(status: string): string {
  if (status === "PUBLISHED") return "Posted";
  if (status === "SCHEDULED") return "Scheduled";
  if (status === "DRAFT") return "Draft";
  if (status === "PENDING_APPROVAL") return "Waiting";
  if (status === "REJECTED") return "Not approved";
  return classAnnouncementStatusLabel(status);
}
