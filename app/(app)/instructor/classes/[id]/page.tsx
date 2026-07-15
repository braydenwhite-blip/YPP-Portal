import { notFound } from "next/navigation";
import { getInstructorClass } from "@/lib/session8/instructor-ops";
import { S8Page, S8Grid, S8Card, S8List, S8Item } from "@/components/session8/portal-ui";
import { dateTime } from "@/lib/session8/format";
import { classAnnouncementStatusLabel } from "@/lib/session8/labels";
import {
  ClassCompletionAction,
  StudentFeedbackPanel,
  AnnouncementComposer,
  AttendanceReviewResponse,
} from "@/components/session8/instructor-class-widgets";

const ATTENDANCE_STATE_LABEL: Record<string, string> = {
  MISSING: "Attendance missing",
  PARTIAL: "Attendance in progress",
  RECORDED: "Recorded, not finalized",
  FINALIZED: "Finalized",
  "N/A": "Not yet due",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c: any = await getInstructorClass(id);
  if (!c) notFound();
  const next = c.sessions.find((s: any) => new Date(s.date) >= new Date());
  const attendanceBySession = new Map(c.sessionAttendanceState.map((a: any) => [a.sessionId, a]));

  return (
    <S8Page
      eyebrow="Instructor class command center"
      title={c.title}
      body="Class overview, next session, roster, preparation, attendance, announcements, feedback, and completion."
      primaryHref={`/instructor/classes/${id}/sessions/${next?.id ?? ""}`}
      primaryLabel={next ? "Next session" : "Class overview"}
    >
      <S8Grid cols={2}>
        <S8Card title="Class Overview">
          <p>Program: {c.template?.title}</p>
          <p>Chapter: {c.chapter?.name ?? "YPP"}</p>
          <p>Partner: {c.partner?.name ?? "None"}</p>
          <p>Schedule: {(c.meetingDays ?? []).join(", ")} · {c.meetingTime}</p>
          <p>Status: {c.status}</p>
        </S8Card>

        <S8Card title="Next Session">
          <S8List
            items={next ? [next] : []}
            empty="No upcoming session."
            render={(s: any) => (
              <S8Item key={s.id} title={s.topic} meta={dateTime(s.date, s.startTime)} status={s.isCancelled ? "CANCELLED" : "READY CHECK"} href={`/instructor/classes/${id}/sessions/${s.id}`}>
                Review materials, logistics, readiness, and attendance status.
              </S8Item>
            )}
          />
        </S8Card>

        <S8Card title="Roster">
          <S8List
            items={c.roster}
            empty="No enrolled students."
            render={(e: any) => (
              <div key={e.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{e.student?.name ?? "Student"}</p>
                    <p className="text-sm text-slate-500">Grade {e.student?.profile?.grade ?? "not set"} · {e.sessionsAttended} attended</p>
                  </div>
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{e.status}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {e.indicators.recentAbsenceConcern && (
                    <span className="rounded-full bg-red-50 border border-red-200 px-2 py-1 text-xs font-semibold text-red-800">
                      {e.indicators.recentAbsences} recent absences
                    </span>
                  )}
                  {e.indicators.newlyEnrolled && (
                    <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-800">Newly enrolled</span>
                  )}
                  {e.indicators.openReviewRequest && (
                    <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-800">Attendance review open</span>
                  )}
                  {e.indicators.formBlocker && (
                    <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-1 text-xs font-semibold text-orange-800">Form blocker</span>
                  )}
                  {e.indicators.releasedFeedback && (
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-800">Feedback released</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-400">Family-safe context only. Restricted support and safeguarding notes are not shown.</p>
              </div>
            )}
          />
        </S8Card>

        <S8Card title="Attendance by Session">
          <S8List
            items={c.sessions.filter((s: any) => !s.isCancelled)}
            empty="No sessions."
            render={(s: any) => {
              const state = attendanceBySession.get(s.id);
              return (
                <S8Item
                  key={s.id}
                  title={s.topic}
                  meta={dateTime(s.date, s.startTime)}
                  status={state ? ATTENDANCE_STATE_LABEL[state.state] : "N/A"}
                  href={`/instructor/classes/${id}/sessions/${s.id}`}
                />
              );
            }}
          />
        </S8Card>

        {c.openReviewRequests.length > 0 && (
          <S8Card title="Attendance Review Requests" subtitle={`${c.openReviewRequests.length} open`}>
            <div className="space-y-3">
              {c.openReviewRequests.map((r: any) => (
                <div key={r.id} className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-900">
                    Review requested for {r.sessionDate ? new Date(r.sessionDate).toLocaleDateString() : "a session"}
                  </p>
                  <p className="text-xs text-amber-700">Status: {r.externalStatus}</p>
                  <AttendanceReviewResponse requestId={r.id} />
                </div>
              ))}
            </div>
          </S8Card>
        )}

        <S8Card title="Preparation & Materials">
          <S8List
            items={c.sessions.slice(0, 6)}
            empty="No sessions."
            render={(s: any) => (
              <S8Item key={s.id} title={s.topic} meta={dateTime(s.date, s.startTime)} href={`/instructor/classes/${id}/sessions/${s.id}`}>
                {s.materialsUrl ? "Materials linked" : "Materials pending"}
              </S8Item>
            )}
          />
        </S8Card>

        <S8Card title="Announcements">
          <AnnouncementComposer offeringId={id} />
          <S8List
            items={c.announcements ?? []}
            empty="No announcements yet."
            render={(a: any) => (
              <S8Item key={a.id} title={a.title ?? "Announcement"} meta={`${classAnnouncementStatusLabel(a.status)} · ${a.audience}`} status={new Date(a.createdAt).toLocaleDateString()}>
                {a.body}
              </S8Item>
            )}
          />
        </S8Card>

        <S8Card title="Student Feedback">
          <StudentFeedbackPanel
            offeringId={id}
            students={c.roster.map((e: any) => ({ id: e.studentId, name: e.student?.name ?? null }))}
            feedback={c.instructorFeedback}
          />
        </S8Card>

        <S8Card title="Completion">
          <ClassCompletionAction offeringId={id} offeringEnded={c.offeringEnded} alreadyCompleted={c.alreadyCompleted} />
        </S8Card>
      </S8Grid>
    </S8Page>
  );
}
